import type { 
  GetPackageReadmeParams, 
  PackageReadmeResponse, 
  UsageExample,
  InstallationInfo,
  PackageBasicInfo,
  RepositoryInfo,
} from '../types/index.js';
import { githubApi } from '../services/github-api.js';
import { readmeParser } from '../services/readme-parser.js';
import { versionResolver } from '../services/version-resolver.js';
import { logger } from '../utils/logger.js';
import { createError } from '../utils/error-handler.js';
import { cache } from '../services/cache.js';
import { searchPackages } from './search-packages.js';
import { validateGetPackageReadmeParams } from '../utils/validators.js';

export async function getPackageReadme(params: GetPackageReadmeParams): Promise<PackageReadmeResponse> {
  const validatedParams = validateGetPackageReadmeParams(params);
  
  const { package_name, version, include_examples = true } = validatedParams;
  
  logger.info('Getting package README', { package_name, version, include_examples });

  try {
    // Check cache first
    const cacheKey = `package_readme:${package_name}:${version || 'latest'}:${include_examples}`;
    const cached = cache.get<PackageReadmeResponse>(cacheKey);
    
    if (cached) {
      logger.debug('Returning cached package README', { package_name });
      return cached;
    }

    // First, search to verify package exists
    logger.debug(`Searching for package existence: ${package_name}`);
    const searchResult = await searchPackages({ query: package_name, limit: 10 });
    
    // Check if the exact package name exists in search results
    const exactMatch = searchResult.packages.find(pkg => pkg.name === package_name);
    if (!exactMatch) {
      logger.info(`Package '${package_name}' not found in vcpkg registry`);
      
      // Return response with exists: false according to specification
      const notFoundResponse: PackageReadmeResponse = {
        package_name,
        version: version || 'latest',
        description: '',
        readme_content: '',
        usage_examples: [],
        installation: generateInstallationInfo(package_name),
        basic_info: {
          name: package_name,
          version: version || 'latest',
          description: '',
          license: '',
          author: '',
          keywords: [],
        },
        exists: false,
      };
      
      return notFoundResponse;
    }
    
    logger.debug(`Package found in search results: ${package_name}`);

    // Resolve version
    const resolvedVersion = await versionResolver.resolveVersion(package_name, version);
    
    // Get package info from vcpkg.json
    const portInfo = await githubApi.getVcpkgPortInfo(package_name);
    if (!portInfo) {
      throw createError('PACKAGE_NOT_FOUND', `Package ${package_name} not found in vcpkg registry`);
    }

    // Get portfile info for additional details
    const portfileInfo = await githubApi.getVcpkgPortfile(package_name);

    // Get README content
    let readmeContent = await githubApi.getReadmeContent(package_name);
    
    // If no README in port directory, try to get from upstream repository
    if (!readmeContent && portfileInfo?.vcpkg_from_github) {
      try {
        const upstreamReadme = await githubApi.getFileContent(
          portfileInfo.vcpkg_from_github.owner,
          portfileInfo.vcpkg_from_github.repo,
          'README.md'
        );
        
        if (upstreamReadme.encoding === 'base64') {
          readmeContent = Buffer.from(upstreamReadme.content, 'base64').toString('utf-8');
        } else {
          readmeContent = upstreamReadme.content;
        }
      } catch (error) {
        logger.debug('Failed to get upstream README', { package_name, error });
      }
    }

    // Fallback to a basic README if none found
    if (!readmeContent) {
      readmeContent = generateFallbackReadme(portInfo, portfileInfo);
    }

    // Clean up README content
    const cleanedContent = readmeParser.cleanupContent(readmeContent);

    // Parse usage examples
    let usageExamples: UsageExample[] = [];
    if (include_examples) {
      usageExamples = readmeParser.parseUsageExamples(cleanedContent);
      
      // Add vcpkg-specific examples
      usageExamples.unshift(...generateVcpkgExamples(package_name, portInfo));
    }

    // Extract description
    const description = portInfo.description || readmeParser.extractDescription(cleanedContent);

    // Build response
    const response: PackageReadmeResponse = {
      package_name,
      version: resolvedVersion,
      description,
      readme_content: cleanedContent,
      usage_examples: usageExamples,
      installation: generateInstallationInfo(package_name),
      basic_info: generateBasicInfo(portInfo, resolvedVersion),
      repository: generateRepositoryInfo(portfileInfo),
      exists: true,
    };

    // Cache the response
    cache.set(cacheKey, response, 60 * 60 * 1000); // 1 hour

    logger.info('Successfully retrieved package README', { 
      package_name, 
      version: resolvedVersion,
      examples_count: usageExamples.length,
    });

    return response;
  } catch (error) {
    logger.error('Failed to get package README', { package_name, version, error });
    throw error;
  }
}

function generateVcpkgExamples(packageName: string, portInfo: any): UsageExample[] {
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

function generateBasicInfo(portInfo: any, version: string): PackageBasicInfo {
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

function generateRepositoryInfo(portfileInfo: any): RepositoryInfo | undefined {
  if (portfileInfo?.vcpkg_from_github) {
    return {
      type: 'git',
      url: `https://github.com/${portfileInfo.vcpkg_from_github.owner}/${portfileInfo.vcpkg_from_github.repo}`,
    };
  }
  return undefined;
}

function generateFallbackReadme(portInfo: any, portfileInfo: any): string {
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