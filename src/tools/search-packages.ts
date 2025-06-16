import type { 
  SearchPackagesParams, 
  SearchPackagesResponse,
  PackageSearchResult,
} from '../types/index.js';
import { githubApi } from '../services/github-api.js';
import { logger } from '../utils/logger.js';
import { validateSearchPackagesParams } from '../utils/validators.js';
import { cache } from '../services/cache.js';

export async function searchPackages(params: SearchPackagesParams): Promise<SearchPackagesResponse> {
  // Validate parameters
  validateSearchPackagesParams(params);
  
  const { query, limit = 20, quality, popularity } = params;
  
  logger.info('Searching packages', { query, limit, quality, popularity });

  try {
    // Check cache first
    const cacheKey = `search_packages:${query}:${limit}:${quality || 'none'}:${popularity || 'none'}`;
    const cached = cache.get<SearchPackagesResponse>(cacheKey);
    
    if (cached) {
      logger.debug('Returning cached search results', { query });
      return cached;
    }

    // Search using GitHub API
    const searchResult = await githubApi.searchPackages(query, Math.min(limit, 100)); // GitHub API limit

    // Process search results
    const packages: PackageSearchResult[] = [];
    
    for (const item of searchResult.items) {
      try {
        // Extract package name from path (ports/package-name/vcpkg.json)
        const pathParts = item.path.split('/');
        if (pathParts.length >= 2 && pathParts[0] === 'ports') {
          const packageName = pathParts[1];
          
          if (!packageName) {continue;}

          // Get package info
          const portInfo = await githubApi.getVcpkgPortInfo(packageName);
          if (!portInfo) {continue;}

          // Get portfile info for additional details
          const portfileInfo = await githubApi.getVcpkgPortfile(packageName);

          // Get upstream repository info for scoring
          let upstreamRepo: any = null;
          if (portfileInfo?.vcpkg_from_github) {
            try {
              const repoUrl = `https://api.github.com/repos/${portfileInfo.vcpkg_from_github.owner}/${portfileInfo.vcpkg_from_github.repo}`;
              const response = await fetch(repoUrl);
              if (response.ok) {
                upstreamRepo = await response.json();
              }
            } catch (error) {
              logger.debug('Failed to get upstream repo for scoring', { packageName, error });
            }
          }

          // Calculate scores
          const scores = calculateScores(portInfo, upstreamRepo, item.score);
          
          // Apply quality and popularity filters
          if (quality !== undefined && scores.detail.quality < quality) {
            continue;
          }
          
          if (popularity !== undefined && scores.detail.popularity < popularity) {
            continue;
          }

          const searchResult: PackageSearchResult = {
            name: packageName,
            version: portInfo.version,
            description: portInfo.description || '',
            keywords: generateKeywords(portInfo, upstreamRepo),
            author: getAuthor(upstreamRepo),
            publisher: 'vcpkg',
            maintainers: getMaintainers(upstreamRepo),
            score: scores,
            searchScore: item.score,
          };

          packages.push(searchResult);
        }
      } catch (error) {
        logger.debug('Failed to process search result item', { item: item.path, error });
        continue;
      }
    }

    // Sort by final score (descending)
    packages.sort((a, b) => b.score.final - a.score.final);

    // Apply limit
    const limitedPackages = packages.slice(0, limit);

    // Build response
    const response: SearchPackagesResponse = {
      query,
      total: searchResult.total_count,
      packages: limitedPackages,
    };

    // Cache the response for 30 minutes
    cache.set(cacheKey, response, 30 * 60 * 1000);

    logger.info('Successfully searched packages', { 
      query, 
      total: response.total,
      returned: limitedPackages.length,
    });

    return response;
  } catch (error) {
    logger.error('Failed to search packages', { query, error });
    throw error;
  }
}

function calculateScores(portInfo: any, upstreamRepo: any, searchScore: number): PackageSearchResult['score'] {
  // Quality score based on package metadata completeness and upstream repository quality
  let qualityScore = 0.5; // Base score
  
  if (portInfo.description) {qualityScore += 0.1;}
  if (portInfo.homepage) {qualityScore += 0.1;}
  if (portInfo.dependencies && portInfo.dependencies.length > 0) {qualityScore += 0.1;}
  
  if (upstreamRepo) {
    if (upstreamRepo.description) {qualityScore += 0.05;}
    if (upstreamRepo.license) {qualityScore += 0.1;}
    if (upstreamRepo.topics && upstreamRepo.topics.length > 0) {qualityScore += 0.05;}
    
    // Penalize archived or disabled repositories
    if (upstreamRepo.archived) {qualityScore -= 0.2;}
    if (upstreamRepo.disabled) {qualityScore -= 0.3;}
  }
  
  qualityScore = Math.max(0, Math.min(1, qualityScore));

  // Popularity score based on upstream repository metrics
  let popularityScore = 0.1; // Base score
  
  if (upstreamRepo) {
    const stars = upstreamRepo.stargazers_count || 0;
    const forks = upstreamRepo.forks_count || 0;
    const watchers = upstreamRepo.watchers_count || 0;
    
    // Normalize scores (log scale to handle wide ranges)
    const starsScore = Math.min(0.4, Math.log10(stars + 1) / 5); // Max 0.4 for stars
    const forksScore = Math.min(0.3, Math.log10(forks + 1) / 4); // Max 0.3 for forks
    const watchersScore = Math.min(0.2, Math.log10(watchers + 1) / 3); // Max 0.2 for watchers
    
    popularityScore = starsScore + forksScore + watchersScore;
  }
  
  popularityScore = Math.max(0, Math.min(1, popularityScore));

  // Maintenance score based on repository activity
  let maintenanceScore = 0.5; // Base score
  
  if (upstreamRepo) {
    const now = new Date();
    const pushedAt = new Date(upstreamRepo.pushed_at);
    const daysSinceUpdate = (now.getTime() - pushedAt.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceUpdate < 30) {maintenanceScore = 1.0;}
    else if (daysSinceUpdate < 90) {maintenanceScore = 0.8;}
    else if (daysSinceUpdate < 180) {maintenanceScore = 0.6;}
    else if (daysSinceUpdate < 365) {maintenanceScore = 0.4;}
    else {maintenanceScore = 0.2;}
    
    // Consider open issues
    const openIssues = upstreamRepo.open_issues_count || 0;
    if (openIssues < 10) {maintenanceScore += 0.1;}
    else if (openIssues > 100) {maintenanceScore -= 0.1;}
  }
  
  maintenanceScore = Math.max(0, Math.min(1, maintenanceScore));

  // Final score combines all factors with search relevance
  const finalScore = (
    qualityScore * 0.3 +
    popularityScore * 0.3 +
    maintenanceScore * 0.2 +
    (searchScore / 100) * 0.2 // Normalize GitHub search score
  );

  return {
    final: Math.max(0, Math.min(1, finalScore)),
    detail: {
      quality: qualityScore,
      popularity: popularityScore,
      maintenance: maintenanceScore,
    },
  };
}

function generateKeywords(portInfo: any, upstreamRepo: any): string[] {
  const keywords = ['vcpkg', 'cpp', 'c++', 'native'];
  
  // Add language from upstream repo
  if (upstreamRepo?.language) {
    keywords.push(upstreamRepo.language.toLowerCase());
  }
  
  // Add topics from upstream repo
  if (upstreamRepo?.topics && Array.isArray(upstreamRepo.topics)) {
    keywords.push(...upstreamRepo.topics.slice(0, 5));
  }
  
  // Add dependency-related keywords
  if (portInfo.dependencies && portInfo.dependencies.length > 0) {
    keywords.push('dependencies');
    
    // Add some common dependency keywords
    for (const dep of portInfo.dependencies.slice(0, 3)) {
      if (dep.includes('boost')) {keywords.push('boost');}
      if (dep.includes('qt')) {keywords.push('qt');}
      if (dep.includes('opencv')) {keywords.push('opencv');}
    }
  }
  
  return [...new Set(keywords)]; // Remove duplicates
}

function getAuthor(upstreamRepo: any): string {
  if (upstreamRepo?.owner?.login) {
    return upstreamRepo.owner.login;
  }
  return 'vcpkg community';
}

function getMaintainers(upstreamRepo: any): string[] {
  const maintainers = ['vcpkg team'];
  
  if (upstreamRepo?.owner?.login) {
    maintainers.push(upstreamRepo.owner.login);
  }
  
  return maintainers;
}