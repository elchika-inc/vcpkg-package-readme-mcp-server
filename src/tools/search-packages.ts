import type { 
  SearchPackagesParams, 
  SearchPackagesResponse,
  PackageSearchResult,
  VcpkgPortInfo,
  VcpkgPortfileInfo,
  GitHubRepository,
} from '../types/index.js';
import { githubApi } from '../services/github-api.js';
import { logger } from '../utils/logger.js';
import { cache } from '../services/cache.js';
import { validateSearchPackagesParams } from '../utils/validators.js';
import { getAuthor, generateKeywords, getMaintainers } from '../utils/vcpkg-helpers.js';

// Scoring constants
const SCORING_WEIGHTS = {
  QUALITY: 0.3,
  POPULARITY: 0.3,
  MAINTENANCE: 0.2,
  SEARCH_RELEVANCE: 0.2,
} as const;

const QUALITY_SCORES = {
  BASE: 0.5,
  DESCRIPTION: 0.1,
  HOMEPAGE: 0.1,
  DEPENDENCIES: 0.1,
  UPSTREAM_DESCRIPTION: 0.05,
  LICENSE: 0.1,
  TOPICS: 0.05,
  ARCHIVED_PENALTY: 0.2,
  DISABLED_PENALTY: 0.3,
} as const;

const POPULARITY_SCORES = {
  BASE: 0.1,
  STARS_MAX: 0.4,
  FORKS_MAX: 0.3,
  WATCHERS_MAX: 0.2,
  STARS_DIVISOR: 5,
  FORKS_DIVISOR: 4,
  WATCHERS_DIVISOR: 3,
} as const;

const MAINTENANCE_THRESHOLDS = {
  RECENT_DAYS: 30,
  GOOD_DAYS: 90,
  MODERATE_DAYS: 180,
  OLD_DAYS: 365,
  LOW_ISSUES: 10,
  HIGH_ISSUES: 100,
} as const;

const CACHE_DURATION = {
  SEARCH_RESULTS: 30 * 60 * 1000, // 30 minutes
} as const;

export async function searchPackages(params: SearchPackagesParams): Promise<SearchPackagesResponse> {
  const validatedParams = validateSearchPackagesParams(params);
  const { query, limit = 20, quality, popularity } = validatedParams;
  
  logger.info('Searching packages', { query, limit, quality, popularity });

  try {
    // Check cache first
    const cached = await getCachedSearchResults(query, limit, quality, popularity);
    if (cached) {
      return cached;
    }

    // Search using GitHub API
    const searchResult = await githubApi.searchPackages(query, Math.min(limit, 100)); // GitHub API limit

    // Process search results
    const packages = await processSearchResults(searchResult.items, quality, popularity);

    // Sort by final score (descending)
    packages.sort((a, b) => b.score.final - a.score.final);

    // Apply limit
    const limitedPackages = packages.slice(0, limit);

    // Build and cache response
    const response = buildSearchResponse(query, searchResult.total_count, limitedPackages);
    await cacheSearchResults(query, limit, quality, popularity, response);

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

async function getCachedSearchResults(
  query: string, 
  limit: number, 
  quality: number | undefined, 
  popularity: number | undefined
): Promise<SearchPackagesResponse | null> {
  const cacheKey = `search_packages:${query}:${limit}:${quality || 'none'}:${popularity || 'none'}`;
  const cached = cache.get<SearchPackagesResponse>(cacheKey);
  
  if (cached) {
    logger.debug('Returning cached search results', { query });
    return cached;
  }
  
  return null;
}

async function processSearchResults(
  items: any[], 
  quality: number | undefined, 
  popularity: number | undefined
): Promise<PackageSearchResult[]> {
  const packages: PackageSearchResult[] = [];
  
  for (const item of items) {
    try {
      const packageResult = await processSearchResultItem(item, quality, popularity);
      if (packageResult) {
        packages.push(packageResult);
      }
    } catch (error) {
      logger.debug('Failed to process search result item', { item: item.path, error });
      continue;
    }
  }
  
  return packages;
}

async function processSearchResultItem(
  item: any, 
  quality: number | undefined, 
  popularity: number | undefined
): Promise<PackageSearchResult | null> {
  // Extract package name from path (ports/package-name/vcpkg.json)
  const pathParts = item.path.split('/');
  if (pathParts.length < 2 || pathParts[0] !== 'ports') {
    return null;
  }
  
  const packageName = pathParts[1];
  if (!packageName) {
    return null;
  }

  // Get package info
  const portInfo = await githubApi.getVcpkgPortInfo(packageName);
  if (!portInfo) {
    return null;
  }

  // Get portfile info for additional details
  const portfileInfo = await githubApi.getVcpkgPortfile(packageName);

  // Get upstream repository info for scoring
  const upstreamRepo = await getUpstreamRepository(portfileInfo, packageName);

  // Calculate scores
  const scores = calculateScores(portInfo, upstreamRepo, item.score);
  
  // Apply quality and popularity filters
  if (quality !== undefined && scores.detail.quality < quality) {
    return null;
  }
  
  if (popularity !== undefined && scores.detail.popularity < popularity) {
    return null;
  }

  return {
    name: packageName,
    version: portInfo.version,
    description: portInfo.description || '',
    keywords: generateKeywords(portInfo, upstreamRepo),
    author: getAuthor(portInfo, upstreamRepo),
    publisher: 'vcpkg',
    maintainers: getMaintainers(upstreamRepo),
    score: scores,
    searchScore: item.score,
  };
}

async function getUpstreamRepository(
  portfileInfo: VcpkgPortfileInfo | null, 
  packageName: string
): Promise<GitHubRepository | null> {
  if (!portfileInfo?.vcpkg_from_github) {
    return null;
  }

  try {
    const repoUrl = `https://api.github.com/repos/${portfileInfo.vcpkg_from_github.owner}/${portfileInfo.vcpkg_from_github.repo}`;
    const response = await fetch(repoUrl);
    if (response.ok) {
      return await response.json() as GitHubRepository;
    }
  } catch (error) {
    logger.debug('Failed to get upstream repo for scoring', { packageName, error });
  }
  
  return null;
}

function buildSearchResponse(
  query: string, 
  totalCount: number, 
  packages: PackageSearchResult[]
): SearchPackagesResponse {
  return {
    query,
    total: totalCount,
    packages,
  };
}

async function cacheSearchResults(
  query: string, 
  limit: number, 
  quality: number | undefined, 
  popularity: number | undefined, 
  response: SearchPackagesResponse
): Promise<void> {
  const cacheKey = `search_packages:${query}:${limit}:${quality || 'none'}:${popularity || 'none'}`;
  cache.set(cacheKey, response, CACHE_DURATION.SEARCH_RESULTS);
}

function calculateScores(portInfo: VcpkgPortInfo, upstreamRepo: GitHubRepository | null, searchScore: number): PackageSearchResult['score'] {
  const qualityScore = calculateQualityScore(portInfo, upstreamRepo);
  const popularityScore = calculatePopularityScore(upstreamRepo);
  const maintenanceScore = calculateMaintenanceScore(upstreamRepo);
  
  // Final score combines all factors with search relevance
  const finalScore = (
    qualityScore * SCORING_WEIGHTS.QUALITY +
    popularityScore * SCORING_WEIGHTS.POPULARITY +
    maintenanceScore * SCORING_WEIGHTS.MAINTENANCE +
    (searchScore / 100) * SCORING_WEIGHTS.SEARCH_RELEVANCE // Normalize GitHub search score
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

function calculateQualityScore(portInfo: VcpkgPortInfo, upstreamRepo: GitHubRepository | null): number {
  let qualityScore = QUALITY_SCORES.BASE;
  
  if (portInfo.description) {
    qualityScore += QUALITY_SCORES.DESCRIPTION;
  }
  if (portInfo.homepage) {
    qualityScore += QUALITY_SCORES.HOMEPAGE;
  }
  if (portInfo.dependencies && portInfo.dependencies.length > 0) {
    qualityScore += QUALITY_SCORES.DEPENDENCIES;
  }
  
  if (upstreamRepo) {
    if (upstreamRepo.description) {
      qualityScore += QUALITY_SCORES.UPSTREAM_DESCRIPTION;
    }
    if (upstreamRepo.license) {
      qualityScore += QUALITY_SCORES.LICENSE;
    }
    if (upstreamRepo.topics && upstreamRepo.topics.length > 0) {
      qualityScore += QUALITY_SCORES.TOPICS;
    }
    
    // Penalize archived or disabled repositories
    if (upstreamRepo.archived) {
      qualityScore -= QUALITY_SCORES.ARCHIVED_PENALTY;
    }
    if (upstreamRepo.disabled) {
      qualityScore -= QUALITY_SCORES.DISABLED_PENALTY;
    }
  }
  
  return Math.max(0, Math.min(1, qualityScore));
}

function calculatePopularityScore(upstreamRepo: GitHubRepository | null): number {
  let popularityScore = POPULARITY_SCORES.BASE;
  
  if (upstreamRepo) {
    const stars = upstreamRepo.stargazers_count || 0;
    const forks = upstreamRepo.forks_count || 0;
    const watchers = upstreamRepo.watchers_count || 0;
    
    // Normalize scores (log scale to handle wide ranges)
    const starsScore = Math.min(POPULARITY_SCORES.STARS_MAX, Math.log10(stars + 1) / POPULARITY_SCORES.STARS_DIVISOR);
    const forksScore = Math.min(POPULARITY_SCORES.FORKS_MAX, Math.log10(forks + 1) / POPULARITY_SCORES.FORKS_DIVISOR);
    const watchersScore = Math.min(POPULARITY_SCORES.WATCHERS_MAX, Math.log10(watchers + 1) / POPULARITY_SCORES.WATCHERS_DIVISOR);
    
    popularityScore = starsScore + forksScore + watchersScore;
  }
  
  return Math.max(0, Math.min(1, popularityScore));
}

function calculateMaintenanceScore(upstreamRepo: GitHubRepository | null): number {
  let maintenanceScore = 0.5; // Base score
  
  if (upstreamRepo) {
    const now = new Date();
    const pushedAt = new Date(upstreamRepo.pushed_at);
    const daysSinceUpdate = (now.getTime() - pushedAt.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceUpdate < MAINTENANCE_THRESHOLDS.RECENT_DAYS) {
      maintenanceScore = 1.0;
    } else if (daysSinceUpdate < MAINTENANCE_THRESHOLDS.GOOD_DAYS) {
      maintenanceScore = 0.8;
    } else if (daysSinceUpdate < MAINTENANCE_THRESHOLDS.MODERATE_DAYS) {
      maintenanceScore = 0.6;
    } else if (daysSinceUpdate < MAINTENANCE_THRESHOLDS.OLD_DAYS) {
      maintenanceScore = 0.4;
    } else {
      maintenanceScore = 0.2;
    }
    
    // Consider open issues
    const openIssues = upstreamRepo.open_issues_count || 0;
    if (openIssues < MAINTENANCE_THRESHOLDS.LOW_ISSUES) {
      maintenanceScore += 0.1;
    } else if (openIssues > MAINTENANCE_THRESHOLDS.HIGH_ISSUES) {
      maintenanceScore -= 0.1;
    }
  }
  
  return Math.max(0, Math.min(1, maintenanceScore));
}

