import type { 
  GetPackageReadmeParams, 
  PackageReadmeResponse, 
  UsageExample,
  InstallationInfo,
  PackageBasicInfo,
  RepositoryInfo,
  VcpkgPortInfo,
  VcpkgPortfileInfo,
} from '../types/index.js';
import { githubApi } from '../services/github-api.js';
import { readmeParser } from '../services/readme-parser.js';
import { versionResolver } from '../services/version-resolver.js';
import { logger } from '../utils/logger.js';
import { createError } from '../utils/error-handler.js';
import { cache } from '../services/cache.js';
import { searchPackages } from './search-packages.js';
import { validateGetPackageReadmeParams } from '../utils/validators.js';
import { generateRepositoryInfo } from '../utils/vcpkg-helpers.js';

export async function getPackageReadme(params: GetPackageReadmeParams): Promise<PackageReadmeResponse> {
  const validatedParams = validateGetPackageReadmeParams(params);
  const { package_name, version, include_examples = true } = validatedParams;
  
  logger.info('Getting package README', { package_name, version, include_examples });

  try {
    // Check cache first
    const cached = await getCachedResponse(package_name, version, include_examples);
    if (cached) {
      return cached;
    }

    // Verify package exists
    const packageExists = await verifyPackageExists(package_name);
    if (!packageExists) {
      return createNotFoundResponse(package_name, version);
    }

    // Get package data
    const packageData = await getPackageData(package_name, version);
    
    // Get README content
    const readmeContent = await getReadmeContent(package_name, packageData.portfileInfo);
    
    // Build final response
    const response = await buildPackageReadmeResponse(
      package_name,
      packageData,
      readmeContent,
      include_examples
    );

    // Cache the response
    const cacheKey = `package_readme:${package_name}:${version || 'latest'}:${include_examples}`;
    cache.set(cacheKey, response, 60 * 60 * 1000); // 1 hour

    logger.info('Successfully retrieved package README', { 
      package_name, 
      version: response.version,
      examples_count: response.usage_examples.length,
    });

    return response;
  } catch (error) {
    logger.error('Failed to get package README', { package_name, version, error });
    throw error;
  }
}

interface PackageData {
  resolvedVersion: string;
  portInfo: VcpkgPortInfo;
  portfileInfo: VcpkgPortfileInfo | null;
}

async function getCachedResponse(
  packageName: string, 
  version: string | undefined, 
  includeExamples: boolean
): Promise<PackageReadmeResponse | null> {
  const cacheKey = `package_readme:${packageName}:${version || 'latest'}:${includeExamples}`;
  const cached = cache.get<PackageReadmeResponse>(cacheKey);
  
  if (cached) {
    logger.debug('Returning cached package README', { package_name: packageName });
    return cached;
  }
  
  return null;
}

async function verifyPackageExists(packageName: string): Promise<boolean> {
  logger.debug(`Searching for package existence: ${packageName}`);
  const searchResult = await searchPackages({ query: packageName, limit: 10 });
  
  const exactMatch = searchResult.packages.find(pkg => pkg.name === packageName);
  if (!exactMatch) {
    logger.info(`Package '${packageName}' not found in vcpkg registry`);
    return false;
  }
  
  logger.debug(`Package found in search results: ${packageName}`);
  return true;
}

function createNotFoundResponse(packageName: string, version: string | undefined): PackageReadmeResponse {
  return {
    package_name: packageName,
    version: version || 'latest',
    description: '',
    readme_content: '',
    usage_examples: [],
    installation: generateInstallationInfo(packageName),
    basic_info: {
      name: packageName,
      version: version || 'latest',
      description: '',
      license: '',
      author: '',
      keywords: [],
    },
    exists: false,
  };
}

async function getPackageData(packageName: string, version: string | undefined): Promise<PackageData> {
  // Resolve version
  const resolvedVersion = await versionResolver.resolveVersion(packageName, version);
  
  // Get package info from vcpkg.json
  const portInfo = await githubApi.getVcpkgPortInfo(packageName);
  if (!portInfo) {
    throw createError('PACKAGE_NOT_FOUND', `Package ${packageName} not found in vcpkg registry`);
  }

  // Get portfile info for additional details
  const portfileInfo = await githubApi.getVcpkgPortfile(packageName);

  return {
    resolvedVersion,
    portInfo,
    portfileInfo,
  };
}

async function getReadmeContent(packageName: string, portfileInfo: VcpkgPortfileInfo | null): Promise<string> {
  // Get README content from port directory
  let readmeContent = await githubApi.getReadmeContent(packageName);
  
  // If no README in port directory, try to get from upstream repository
  if (!readmeContent && portfileInfo?.vcpkg_from_github) {
    readmeContent = await getUpstreamReadme(packageName, portfileInfo);
  }

  return readmeContent || '';
}

async function getUpstreamReadme(packageName: string, portfileInfo: VcpkgPortfileInfo): Promise<string | null> {
  if (!portfileInfo.vcpkg_from_github) {
    return null;
  }

  try {
    const upstreamReadme = await githubApi.getFileContent(
      portfileInfo.vcpkg_from_github.owner,
      portfileInfo.vcpkg_from_github.repo,
      'README.md'
    );
    
    if (upstreamReadme.encoding === 'base64') {
      return Buffer.from(upstreamReadme.content, 'base64').toString('utf-8');
    } else {
      return upstreamReadme.content;
    }
  } catch (error) {
    logger.debug('Failed to get upstream README', { package_name: packageName, error });
    return null;
  }
}

async function buildPackageReadmeResponse(
  packageName: string,
  packageData: PackageData,
  readmeContent: string,
  includeExamples: boolean
): Promise<PackageReadmeResponse> {
  // Use fallback README if none found
  const finalReadmeContent = readmeContent || generateFallbackReadme(packageData.portInfo, packageData.portfileInfo);
  
  // Clean up README content
  const cleanedContent = readmeParser.cleanupContent(finalReadmeContent);

  // Parse usage examples
  const usageExamples = includeExamples 
    ? await generateUsageExamples(packageName, packageData.portInfo, cleanedContent)
    : [];

  // Extract description
  const description = packageData.portInfo.description || readmeParser.extractDescription(cleanedContent);

  return {
    package_name: packageName,
    version: packageData.resolvedVersion,
    description,
    readme_content: cleanedContent,
    usage_examples: usageExamples,
    installation: generateInstallationInfo(packageName),
    basic_info: generateBasicInfo(packageData.portInfo, packageData.resolvedVersion),
    repository: generateRepositoryInfo(packageData.portfileInfo),
    exists: true,
  };
}

async function generateUsageExamples(packageName: string, portInfo: VcpkgPortInfo, cleanedContent: string): Promise<UsageExample[]> {
  const parsedExamples = readmeParser.parseUsageExamples(cleanedContent);
  const vcpkgExamples = generateVcpkgExamples(packageName, portInfo);
  
  return [...vcpkgExamples, ...parsedExamples];
}

function generateVcpkgExamples(packageName: string, portInfo: VcpkgPortInfo): UsageExample[] {
  const examples: UsageExample[] = [];

  // Vcpkg install example
  examples.push({
    title: 'Install with vcpkg',
    description: 'Install the package using vcpkg package manager',
    code: `vcpkg install ${packageName}`,
    language: 'bash',
  });

  // CMake integration example
  examples.push({
    title: 'CMake Integration',
    description: 'Use the package in your CMake project with vcpkg toolchain',
    code: `# In your CMakeLists.txt
find_package(${packageName} CONFIG REQUIRED)
target_link_libraries(your_target PRIVATE ${packageName})`,
    language: 'cmake',
  });

  // If package has features, show feature installation
  if (portInfo.features && Object.keys(portInfo.features).length > 0) {
    const features = Object.keys(portInfo.features);
    examples.push({
      title: 'Install with Features',
      description: 'Install the package with specific features enabled',
      code: `vcpkg install ${packageName}[${features.slice(0, 2).join(',')}]`,
      language: 'bash',
    });
  }

  return examples;
}

function generateInstallationInfo(packageName: string): InstallationInfo {
  return {
    command: `vcpkg install ${packageName}`,
    alternatives: [
      `vcpkg install ${packageName}:x64-windows`,
      `vcpkg install ${packageName}:x64-linux`,
      `vcpkg install ${packageName}:x64-osx`,
    ],
  };
}

function generateBasicInfo(portInfo: VcpkgPortInfo, version: string): PackageBasicInfo {
  return {
    name: portInfo.name,
    version,
    description: portInfo.description || '',
    homepage: portInfo.homepage,
    license: 'See upstream repository', // vcpkg doesn't always specify license
    author: 'vcpkg community',
    keywords: ['vcpkg', 'cpp', 'c++', 'native'],
  };
}


function generateFallbackReadme(portInfo: VcpkgPortInfo, portfileInfo: VcpkgPortfileInfo | null): string {
  let readme = `# ${portInfo.name}\n\n`;
  
  if (portInfo.description) {
    readme += `${portInfo.description}\n\n`;
  }
  
  if (portInfo.homepage) {
    readme += `**Homepage:** ${portInfo.homepage}\n\n`;
  }
  
  readme += `## Installation\n\n`;
  readme += `\`\`\`bash\n`;
  readme += `vcpkg install ${portInfo.name}\n`;
  readme += `\`\`\`\n\n`;
  
  readme += `## Usage\n\n`;
  readme += `Add the following to your CMakeLists.txt:\n\n`;
  readme += `\`\`\`cmake\n`;
  readme += `find_package(${portInfo.name} CONFIG REQUIRED)\n`;
  readme += `target_link_libraries(your_target PRIVATE ${portInfo.name})\n`;
  readme += `\`\`\`\n\n`;
  
  if (portInfo.dependencies && portInfo.dependencies.length > 0) {
    readme += `## Dependencies\n\n`;
    for (const dep of portInfo.dependencies) {
      readme += `- ${dep}\n`;
    }
    readme += `\n`;
  }
  
  if (portfileInfo?.vcpkg_from_github) {
    readme += `## Source\n\n`;
    readme += `This package is based on [${portfileInfo.vcpkg_from_github.owner}/${portfileInfo.vcpkg_from_github.repo}](https://github.com/${portfileInfo.vcpkg_from_github.owner}/${portfileInfo.vcpkg_from_github.repo}).\n\n`;
  }
  
  return readme;
}