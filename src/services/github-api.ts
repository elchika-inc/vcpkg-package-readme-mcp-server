import type {
  GitHubSearchResult,
  GitHubFileContent,
  VcpkgPortInfo,
  VcpkgPortfileInfo,
} from '../types/index.js';
import { logger } from '../utils/logger.js';
import { handleApiError, handleHttpError } from '../utils/error-handler.js';
import { cache } from './cache.js';

export class GitHubApiClient {
  private baseUrl = 'https://api.github.com';
  private token = process.env.GITHUB_TOKEN;
  private timeout = parseInt(process.env.REQUEST_TIMEOUT || '30000');

  private async makeRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'vcpkg-package-readme-mcp-server',
        ...((options.headers as Record<string, string>) || {}),
      };

      if (this.token) {
        headers['Authorization'] = `token ${this.token}`;
      } else {
        logger.warn('GITHUB_TOKEN not set, using unauthenticated requests (rate limited)');
      }

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw handleHttpError(response, 'GitHub API');
      }

      return await response.json() as T;
    } catch (error) {
      clearTimeout(timeoutId);
      throw handleApiError(error, 'GitHub API');
    }
  }

  async searchPackages(query: string, limit = 20): Promise<GitHubSearchResult> {
    const cacheKey = `github_search:${query}:${limit}`;
    const cached = cache.get<GitHubSearchResult>(cacheKey);
    
    if (cached) {
      return cached;
    }

    // Search for port directories in the Microsoft/vcpkg repository
    const searchQuery = `repo:Microsoft/vcpkg path:ports/ filename:vcpkg.json ${query}`;
    const url = `${this.baseUrl}/search/code?q=${encodeURIComponent(searchQuery)}&per_page=${limit}`;

    logger.debug('Searching GitHub for vcpkg packages', { query, limit });

    const result = await this.makeRequest<GitHubSearchResult>(url);

    // Cache for 30 minutes
    cache.set(cacheKey, result, 30 * 60 * 1000);

    return result;
  }

  async getFileContent(owner: string, repo: string, path: string, ref = 'master'): Promise<GitHubFileContent> {
    const cacheKey = `github_file:${owner}/${repo}:${path}:${ref}`;
    const cached = cache.get<GitHubFileContent>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const url = `${this.baseUrl}/repos/${owner}/${repo}/contents/${path}?ref=${ref}`;

    logger.debug('Fetching file content from GitHub', { owner, repo, path, ref });

    const result = await this.makeRequest<GitHubFileContent>(url);

    // Cache for 1 hour
    cache.set(cacheKey, result, 60 * 60 * 1000);

    return result;
  }

  async getVcpkgPortInfo(packageName: string): Promise<VcpkgPortInfo | null> {
    try {
      const vcpkgJsonPath = `ports/${packageName}/vcpkg.json`;
      const fileContent = await this.getFileContent('Microsoft', 'vcpkg', vcpkgJsonPath);
      
      if (fileContent.encoding === 'base64') {
        const content = Buffer.from(fileContent.content, 'base64').toString('utf-8');
        return JSON.parse(content) as VcpkgPortInfo;
      } else {
        return JSON.parse(fileContent.content) as VcpkgPortInfo;
      }
    } catch (error) {
      logger.debug('Failed to get vcpkg.json', { packageName, error });
      
      // Try fallback with CONTROL file (legacy format)
      try {
        const controlPath = `ports/${packageName}/CONTROL`;
        const fileContent = await this.getFileContent('Microsoft', 'vcpkg', controlPath);
        
        let content: string;
        if (fileContent.encoding === 'base64') {
          content = Buffer.from(fileContent.content, 'base64').toString('utf-8');
        } else {
          content = fileContent.content;
        }
        
        return this.parseControlFile(content, packageName);
      } catch (controlError) {
        logger.debug('Failed to get CONTROL file', { packageName, error: controlError });
        return null;
      }
    }
  }

  async getVcpkgPortfile(packageName: string): Promise<VcpkgPortfileInfo | null> {
    try {
      const portfilePath = `ports/${packageName}/portfile.cmake`;
      const fileContent = await this.getFileContent('Microsoft', 'vcpkg', portfilePath);
      
      let content: string;
      if (fileContent.encoding === 'base64') {
        content = Buffer.from(fileContent.content, 'base64').toString('utf-8');
      } else {
        content = fileContent.content;
      }
      
      return this.parsePortfile(content);
    } catch (error) {
      logger.debug('Failed to get portfile.cmake', { packageName, error });
      return null;
    }
  }

  async getReadmeContent(packageName: string): Promise<string | null> {
    // Try to get README from the port directory
    const readmeFiles = ['README.md', 'readme.md', 'Readme.md', 'README', 'readme'];
    
    for (const filename of readmeFiles) {
      try {
        const readmePath = `ports/${packageName}/${filename}`;
        const fileContent = await this.getFileContent('Microsoft', 'vcpkg', readmePath);
        
        if (fileContent.encoding === 'base64') {
          return Buffer.from(fileContent.content, 'base64').toString('utf-8');
        } else {
          return fileContent.content;
        }
      } catch (error) {
        // Continue to next filename
      }
    }

    logger.debug('No README found for package', { packageName });
    return null;
  }

  private parseControlFile(content: string, packageName: string): VcpkgPortInfo {
    const lines = content.split('\n');
    const info: Partial<VcpkgPortInfo> = {
      name: packageName,
      version: 'unknown',
      description: '',
    };

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('Version:')) {
        info.version = trimmedLine.substring(8).trim();
      } else if (trimmedLine.startsWith('Description:')) {
        info.description = trimmedLine.substring(12).trim();
      } else if (trimmedLine.startsWith('Homepage:')) {
        info.homepage = trimmedLine.substring(9).trim();
      } else if (trimmedLine.startsWith('Build-Depends:')) {
        const deps = trimmedLine.substring(14).trim();
        info.dependencies = deps.split(',').map(dep => dep.trim()).filter(dep => dep);
      }
    }

    return info as VcpkgPortInfo;
  }

  private parsePortfile(content: string): VcpkgPortfileInfo {
    const info: VcpkgPortfileInfo = {};

    // Extract vcpkg_from_github information
    const githubMatch = content.match(/vcpkg_from_github\s*\(\s*OUT_SOURCE_PATH\s+\w+\s+REPO\s+([^/]+)\/([^\s]+)\s+REF\s+([^\s]+)\s+SHA512\s+([^\s)]+)/s);
    if (githubMatch && githubMatch[1] && githubMatch[2] && githubMatch[3] && githubMatch[4]) {
      info.vcpkg_from_github = {
        owner: githubMatch[1],
        repo: githubMatch[2],
        ref: githubMatch[3],
        sha512: githubMatch[4],
      };
    }

    return info;
  }
}

export const githubApi = new GitHubApiClient();