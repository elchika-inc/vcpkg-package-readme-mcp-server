import type { 
  GetPackageInfoParams, 
  PackageInfoResponse,
  DownloadStats,
  RepositoryInfo,
  VcpkgPortInfo,
  VcpkgPortfileInfo,
  VcpkgDependency,
  GitHubRepository,
} from '../types/index.js';
import { githubApi } from '../services/github-api.js';
import { versionResolver } from '../services/version-resolver.js';
import { logger } from '../utils/logger.js';
// import { createError } from '../utils/error-handler.js';
import { cache } from '../services/cache.js';
import { validateGetPackageInfoParams } from '../utils/validators.js';
import { generateRepositoryInfo, getAuthor, getLicense, generateKeywords } from '../utils/vcpkg-helpers.js';

export async function getPackageInfo(params: GetPackageInfoParams): Promise<PackageInfoResponse> {
  const validatedParams = validateGetPackageInfoParams(params);
  
  const { package_name, include_dependencies = true, include_dev_dependencies = false } = validatedParams;
  
  logger.info('Getting package info', { package_name, include_dependencies, include_dev_dependencies });

  try {
    // Check cache first
    const cacheKey = `package_info:${package_name}:${include_dependencies}:${include_dev_dependencies}`;
    const cached = cache.get<PackageInfoResponse>(cacheKey);
    
    if (cached) {
      logger.debug('Returning cached package info', { package_name });
      return cached;
    }

    // Get package info from vcpkg.json
    const portInfo = await githubApi.getVcpkgPortInfo(package_name);
    if (!portInfo) {
      logger.info(`Package '${package_name}' not found in vcpkg registry`);
      
      // Return response with exists: false according to specification
      const notFoundResponse: PackageInfoResponse = {
        package_name,
        latest_version: '',
        description: '',
        author: '',
        license: '',
        keywords: [],
        download_stats: {
          last_day: 0,
          last_week: 0,
          last_month: 0,
        },
        exists: false,
      };
      
      return notFoundResponse;
    }

    // Get portfile info for additional details
    const portfileInfo = await githubApi.getVcpkgPortfile(package_name);

    // Get latest version
    const latestVersion = await versionResolver.getLatestVersion(package_name);

    // Get repository info
    const repository = generateRepositoryInfo(portfileInfo);

    // Get upstream repository info if available
    let upstreamRepo: GitHubRepository | null = null;
    if (portfileInfo?.vcpkg_from_github) {
      try {
        const repoUrl = `https://api.github.com/repos/${portfileInfo.vcpkg_from_github.owner}/${portfileInfo.vcpkg_from_github.repo}`;
        const response = await fetch(repoUrl);
        if (response.ok) {
          upstreamRepo = await response.json() as GitHubRepository;
        }
      } catch (error) {
        logger.debug('Failed to get upstream repository info', { package_name, error });
      }
    }

    // Build dependencies
    let dependencies: Record<string, string> | undefined;
    let devDependencies: Record<string, string> | undefined;

    if (include_dependencies && portInfo.dependencies) {
      dependencies = {};
      for (const dep of portInfo.dependencies) {
        let depName: string;
        if (typeof dep === 'string') {
          // Parse dependency string (may have features like "boost[system,filesystem]")
          depName = dep.split('[')[0] || dep;
        } else if (typeof dep === 'object' && dep !== null && 'name' in dep) {
          // Handle dependency objects like { "name": "boost", "features": ["system"] }
          depName = (dep as VcpkgDependency).name;
        } else {
          // Skip invalid dependency entries
          continue;
        }
        dependencies[depName] = 'latest'; // vcpkg doesn't specify versions for dependencies
      }
    }

    // vcpkg typically doesn't have dev dependencies in the same way as npm
    if (include_dev_dependencies) {
      devDependencies = {};
    }

    // Generate download stats (vcpkg doesn't have download stats, so we'll use repository stats)
    const downloadStats = generateDownloadStats(upstreamRepo);

    // Build response
    const response: PackageInfoResponse = {
      package_name,
      latest_version: latestVersion,
      description: portInfo.description || '',
      author: getAuthor(portInfo, upstreamRepo),
      license: getLicense(upstreamRepo) || 'See upstream repository',
      keywords: generateKeywords(portInfo, upstreamRepo),
      dependencies,
      dev_dependencies: devDependencies,
      download_stats: downloadStats,
      repository,
      exists: true,
    };

    // Cache the response
    cache.set(cacheKey, response, 60 * 60 * 1000); // 1 hour

    logger.info('Successfully retrieved package info', { 
      package_name, 
      version: latestVersion,
      dependencies_count: dependencies ? Object.keys(dependencies).length : 0,
    });

    return response;
  } catch (error) {
    logger.error('Failed to get package info', { package_name, error });
    throw error;
  }
}


function generateDownloadStats(upstreamRepo: GitHubRepository | null): DownloadStats {
  // Since vcpkg doesn't have download stats, we'll use repository metrics as a proxy
  const baseStats = {
    last_day: 0,
    last_week: 0,
    last_month: 0,
  };

  if (upstreamRepo) {
    // Use stars as a rough approximation of popularity/usage
    const stars = upstreamRepo.stargazers_count || 0;
    const forks = upstreamRepo.forks_count || 0;
    
    // Very rough approximation based on repository activity
    baseStats.last_month = Math.floor((stars + forks) / 10);
    baseStats.last_week = Math.floor(baseStats.last_month / 4);
    baseStats.last_day = Math.floor(baseStats.last_week / 7);
  }

  return baseStats;
}