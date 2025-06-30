// Parameter types for MCP tools
export interface GetPackageReadmeParams {
  package_name: string;
  version?: string;
  include_examples?: boolean;
}

export interface GetPackageInfoParams {
  package_name: string;
  include_dependencies?: boolean;
  include_dev_dependencies?: boolean;
}

export interface SearchPackagesParams {
  query: string;
  limit?: number;
  quality?: number;
  popularity?: number;
}

// Response types
export interface PackageReadmeResponse {
  package_name: string;
  version: string;
  description: string;
  readme_content: string;
  usage_examples: UsageExample[];
  installation: InstallationInfo;
  basic_info: PackageBasicInfo;
  repository?: RepositoryInfo | undefined;
  exists: boolean;
}

export interface PackageInfoResponse {
  package_name: string;
  latest_version: string;
  description: string;
  author: string;
  license: string;
  keywords: string[];
  dependencies?: Record<string, string> | undefined;
  dev_dependencies?: Record<string, string> | undefined;
  download_stats: DownloadStats;
  repository?: RepositoryInfo | undefined;
  exists: boolean;
}

export interface SearchPackagesResponse {
  query: string;
  total: number;
  packages: PackageSearchResult[];
}

// Common data types
export interface UsageExample {
  title: string;
  description?: string | undefined;
  code: string;
  language: string;
}

export interface InstallationInfo {
  command: string;
  alternatives?: string[];
}

export interface PackageBasicInfo {
  name: string;
  version: string;
  description: string;
  main?: string;
  types?: string;
  homepage?: string;
  bugs?: string;
  license: string;
  author: string | AuthorInfo;
  contributors?: AuthorInfo[];
  keywords: string[];
}

export interface AuthorInfo {
  name: string;
  email?: string;
  url?: string;
}

export interface RepositoryInfo {
  type: string;
  url: string;
  directory?: string;
}

export interface DownloadStats {
  last_day: number;
  last_week: number;
  last_month: number;
}

export interface PackageSearchResult {
  name: string;
  version: string;
  description: string;
  keywords: string[];
  author: string;
  publisher: string;
  maintainers: string[];
  score: {
    final: number;
    detail: {
      quality: number;
      popularity: number;
      maintenance: number;
    };
  };
  searchScore: number;
}

// Vcpkg-specific types
export interface VcpkgDependency {
  name: string;
  features?: string[];
  platform?: string;
  host?: boolean;
}

export interface VcpkgPortInfo {
  name: string;
  version: string;
  description: string;
  homepage?: string;
  dependencies?: (string | VcpkgDependency)[];
  features?: Record<string, VcpkgFeature>;
  supports?: string;
}

export interface VcpkgFeature {
  description: string;
  dependencies?: (string | VcpkgDependency)[];
}

export interface VcpkgGitHubSource {
  owner: string;
  repo: string;
  ref: string;
  sha512: string;
}

export interface VcpkgPortfileInfo {
  vcpkg_from_github?: VcpkgGitHubSource;
  vcpkg_configure?: Record<string, unknown>;
  vcpkg_install?: Record<string, unknown>;
}

export interface VcpkgSearchResult {
  name: string;
  version: string;
  description: string;
  homepage?: string;
  repository?: RepositoryInfo;
  dependencies?: (string | VcpkgDependency)[];
  supports?: string;
  stars?: number;
  forks?: number;
  updated_at?: string;
}

// GitHub API types
export interface GitHubSearchResult {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubSearchItem[];
}

export interface GitHubSearchItem {
  name: string;
  path: string;
  sha: string;
  url: string;
  git_url: string;
  html_url: string;
  repository: GitHubRepository;
  score: number;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: GitHubUser;
  private: boolean;
  html_url: string;
  description: string;
  fork: boolean;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  stargazers_count: number;
  watchers_count: number;
  language: string;
  forks_count: number;
  archived: boolean;
  disabled: boolean;
  open_issues_count: number;
  license?: GitHubLicense;
  default_branch: string;
  topics?: string[];
}

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  gravatar_id: string;
  url: string;
  html_url: string;
  type: string;
  site_admin: boolean;
}

export interface GitHubLicense {
  key: string;
  name: string;
  spdx_id: string;
  url: string;
}

export interface GitHubFileContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string;
  type: string;
  content: string;
  encoding: string;
}

// Error types
export class PackageReadmeMcpError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PackageReadmeMcpError';
  }
}

// Cache types
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  maxSize: number;
}