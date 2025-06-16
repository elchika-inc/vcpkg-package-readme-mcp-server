import { githubApi } from './github-api.js';
import { logger } from '../utils/logger.js';
import { createError } from '../utils/error-handler.js';
import { cache } from './cache.js';

export class VersionResolver {
  async resolveVersion(packageName: string, requestedVersion?: string): Promise<string> {
    if (!requestedVersion || requestedVersion === 'latest') {
      return await this.getLatestVersion(packageName);
    }
    
    // For vcpkg, we mainly work with the latest version from the master branch
    // But we can validate if the requested version exists in the port info
    const portInfo = await githubApi.getVcpkgPortInfo(packageName);
    if (!portInfo) {
      throw createError('PACKAGE_NOT_FOUND', `Package ${packageName} not found`);
    }
    
    // If a specific version is requested, check if it matches the port version
    if (requestedVersion !== portInfo.version && requestedVersion !== 'latest') {
      logger.warn('Requested version may not match port version', {
        packageName,
        requestedVersion,
        portVersion: portInfo.version,
      });
    }
    
    return portInfo.version;
  }

  async getLatestVersion(packageName: string): Promise<string> {
    const cacheKey = `latest_version:${packageName}`;
    const cached = cache.get<string>(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const portInfo = await githubApi.getVcpkgPortInfo(packageName);
      if (!portInfo) {
        throw createError('PACKAGE_NOT_FOUND', `Package ${packageName} not found`);
      }

      const version = portInfo.version;
      
      // Cache for 1 hour
      cache.set(cacheKey, version, 60 * 60 * 1000);
      
      return version;
    } catch (error) {
      logger.error('Failed to get latest version', { packageName, error });
      throw error;
    }
  }

  async getAvailableVersions(packageName: string): Promise<string[]> {
    // For vcpkg, we typically only have one version per port (the latest in master)
    // But we could potentially get version history from git history
    try {
      const version = await this.getLatestVersion(packageName);
      return [version];
    } catch (error) {
      logger.error('Failed to get available versions', { packageName, error });
      return [];
    }
  }
}

export const versionResolver = new VersionResolver();