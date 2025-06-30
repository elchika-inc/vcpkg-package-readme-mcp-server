import type {
  RepositoryInfo,
  VcpkgPortfileInfo,
  GitHubRepository,
  VcpkgPortInfo,
} from '../types/index.js';

export function generateRepositoryInfo(portfileInfo: VcpkgPortfileInfo | null): RepositoryInfo | undefined {
  if (portfileInfo?.vcpkg_from_github) {
    return {
      type: 'git',
      url: `https://github.com/${portfileInfo.vcpkg_from_github.owner}/${portfileInfo.vcpkg_from_github.repo}`,
    };
  }
  return {
    type: 'git',
    url: 'https://github.com/Microsoft/vcpkg',
    directory: `ports/unknown`,
  };
}

export function getAuthor(_portInfo: VcpkgPortInfo, upstreamRepo: GitHubRepository | null): string {
  if (upstreamRepo?.owner?.login) {
    return upstreamRepo.owner.login;
  }
  return 'vcpkg community';
}

export function generateKeywords(portInfo: VcpkgPortInfo, upstreamRepo: GitHubRepository | null): string[] {
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
      const depName = typeof dep === 'string' ? dep : dep.name;
      if (depName.includes('boost')) { keywords.push('boost'); }
      if (depName.includes('qt')) { keywords.push('qt'); }
      if (depName.includes('opencv')) { keywords.push('opencv'); }
    }
  }
  
  return [...new Set(keywords)]; // Remove duplicates
}

export function getLicense(upstreamRepo: GitHubRepository | null): string | undefined {
  if (upstreamRepo?.license?.name) {
    return upstreamRepo.license.name;
  }
  return undefined;
}

export function getMaintainers(upstreamRepo: GitHubRepository | null): string[] {
  const maintainers = ['vcpkg team'];
  
  if (upstreamRepo?.owner?.login) {
    maintainers.push(upstreamRepo.owner.login);
  }
  
  return maintainers;
}