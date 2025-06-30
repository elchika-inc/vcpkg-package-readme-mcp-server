import { describe, it, expect } from 'vitest';
import {
  generateRepositoryInfo,
  getAuthor,
  generateKeywords,
  getLicense,
  getMaintainers,
} from '../../src/utils/vcpkg-helpers.js';
import type {
  VcpkgPortfileInfo,
  GitHubRepository,
  VcpkgPortInfo,
} from '../../src/types/index.js';

describe('vcpkg-helpers', () => {
  describe('generateRepositoryInfo', () => {
    it('should generate repository info from portfile with vcpkg_from_github', () => {
      const portfileInfo: VcpkgPortfileInfo = {
        vcpkg_from_github: {
          owner: 'boostorg',
          repo: 'boost',
          ref: 'boost-1.82.0',
          sha512: 'abc123',
        },
      };

      const result = generateRepositoryInfo(portfileInfo);

      expect(result).toEqual({
        type: 'git',
        url: 'https://github.com/boostorg/boost',
      });
    });

    it('should return default repository info when portfileInfo is null', () => {
      const result = generateRepositoryInfo(null);

      expect(result).toEqual({
        type: 'git',
        url: 'https://github.com/Microsoft/vcpkg',
        directory: 'ports/unknown',
      });
    });

    it('should return default repository info when vcpkg_from_github is missing', () => {
      const portfileInfo: VcpkgPortfileInfo = {};

      const result = generateRepositoryInfo(portfileInfo);

      expect(result).toEqual({
        type: 'git',
        url: 'https://github.com/Microsoft/vcpkg',
        directory: 'ports/unknown',
      });
    });

    it('should handle portfileInfo with incomplete vcpkg_from_github', () => {
      const portfileInfo: VcpkgPortfileInfo = {
        vcpkg_from_github: {
          owner: 'microsoft',
          repo: '', // Missing repo
          ref: 'main',
          sha512: 'def456',
        },
      };

      const result = generateRepositoryInfo(portfileInfo);

      expect(result).toEqual({
        type: 'git',
        url: 'https://github.com/microsoft/',
      });
    });

    it('should handle various GitHub repository URLs', () => {
      const testCases = [
        { owner: 'microsoft', repo: 'vcpkg-tool', expected: 'https://github.com/microsoft/vcpkg-tool' },
        { owner: 'opencv', repo: 'opencv', expected: 'https://github.com/opencv/opencv' },
        { owner: 'google', repo: 'gtest', expected: 'https://github.com/google/gtest' },
      ];

      testCases.forEach(({ owner, repo, expected }) => {
        const portfileInfo: VcpkgPortfileInfo = {
          vcpkg_from_github: {
            owner,
            repo,
            ref: 'main',
            sha512: 'hash',
          },
        };

        const result = generateRepositoryInfo(portfileInfo);
        expect(result?.url).toBe(expected);
      });
    });
  });

  describe('getAuthor', () => {
    it('should return upstream repository owner when available', () => {
      const portInfo = {} as VcpkgPortInfo;
      const upstreamRepo: GitHubRepository = {
        id: 123,
        name: 'boost',
        full_name: 'boostorg/boost',
        owner: {
          login: 'boostorg',
          id: 456,
          avatar_url: 'https://avatars.githubusercontent.com/u/456',
          type: 'Organization',
        },
        private: false,
        html_url: 'https://github.com/boostorg/boost',
        description: 'Super-project for modularized Boost',
        language: 'C++',
        stargazers_count: 5000,
        watchers_count: 5000,
        forks_count: 1000,
      };

      const result = getAuthor(portInfo, upstreamRepo);

      expect(result).toBe('boostorg');
    });

    it('should return default author when upstream repo is null', () => {
      const portInfo = {} as VcpkgPortInfo;

      const result = getAuthor(portInfo, null);

      expect(result).toBe('vcpkg community');
    });

    it('should return default author when upstream repo owner is missing', () => {
      const portInfo = {} as VcpkgPortInfo;
      const upstreamRepo = {
        id: 123,
        name: 'test',
        full_name: 'test/test',
        // owner is missing
        private: false,
        html_url: 'https://github.com/test/test',
        language: 'C++',
        stargazers_count: 100,
        watchers_count: 100,
        forks_count: 10,
      } as GitHubRepository;

      const result = getAuthor(portInfo, upstreamRepo);

      expect(result).toBe('vcpkg community');
    });

    it('should return default author when owner login is empty', () => {
      const portInfo = {} as VcpkgPortInfo;
      const upstreamRepo: GitHubRepository = {
        id: 123,
        name: 'test',
        full_name: 'test/test',
        owner: {
          login: '',
          id: 456,
          avatar_url: 'https://avatars.githubusercontent.com/u/456',
          type: 'User',
        },
        private: false,
        html_url: 'https://github.com/test/test',
        language: 'C++',
        stargazers_count: 100,
        watchers_count: 100,
        forks_count: 10,
      };

      const result = getAuthor(portInfo, upstreamRepo);

      expect(result).toBe('vcpkg community');
    });
  });

  describe('generateKeywords', () => {
    it('should generate basic keywords for minimal port info', () => {
      const portInfo: VcpkgPortInfo = {
        name: 'test-package',
        version: '1.0.0',
        description: 'A test package',
      };

      const result = generateKeywords(portInfo, null);

      expect(result).toEqual(['vcpkg', 'cpp', 'c++', 'native']);
    });

    it('should add language from upstream repository', () => {
      const portInfo: VcpkgPortInfo = {
        name: 'test-package',
        version: '1.0.0',
        description: 'A test package',
      };

      const upstreamRepo: GitHubRepository = {
        id: 123,
        name: 'test',
        full_name: 'test/test',
        owner: {
          login: 'testuser',
          id: 456,
          avatar_url: 'https://avatars.githubusercontent.com/u/456',
          type: 'User',
        },
        private: false,
        html_url: 'https://github.com/test/test',
        language: 'Python', // Should be added as lowercase
        stargazers_count: 100,
        watchers_count: 100,
        forks_count: 10,
      };

      const result = generateKeywords(portInfo, upstreamRepo);

      expect(result).toContain('python');
      expect(result).toContain('vcpkg');
      expect(result).toContain('cpp');
    });

    it('should add topics from upstream repository', () => {
      const portInfo: VcpkgPortInfo = {
        name: 'test-package',
        version: '1.0.0',
        description: 'A test package',
      };

      const upstreamRepo: GitHubRepository = {
        id: 123,
        name: 'test',
        full_name: 'test/test',
        owner: {
          login: 'testuser',
          id: 456,
          avatar_url: 'https://avatars.githubusercontent.com/u/456',
          type: 'User',
        },
        private: false,
        html_url: 'https://github.com/test/test',
        language: 'C++',
        topics: ['graphics', 'rendering', 'opengl', 'vulkan', 'game-engine', 'too-many-topics'], // Should limit to 5
        stargazers_count: 100,
        watchers_count: 100,
        forks_count: 10,
      };

      const result = generateKeywords(portInfo, upstreamRepo);

      expect(result).toContain('graphics');
      expect(result).toContain('rendering');
      expect(result).toContain('opengl');
      expect(result).toContain('vulkan');
      expect(result).toContain('game-engine');
      expect(result).not.toContain('too-many-topics'); // Should be limited to 5 topics
    });

    it('should add dependency-related keywords', () => {
      const portInfo: VcpkgPortInfo = {
        name: 'test-package',
        version: '1.0.0',
        description: 'A test package',
        dependencies: ['boost-algorithm', 'qt5-core', 'opencv4'],
      };

      const result = generateKeywords(portInfo, null);

      expect(result).toContain('dependencies');
      expect(result).toContain('boost');
      expect(result).toContain('qt');
      expect(result).toContain('opencv');
    });

    it('should handle object dependencies', () => {
      const portInfo: VcpkgPortInfo = {
        name: 'test-package',
        version: '1.0.0',
        description: 'A test package',
        dependencies: [
          { name: 'boost-filesystem' },
          { name: 'qt5-widgets' },
          { name: 'other-dep' },
          { name: 'fourth-dep' }, // Should be ignored due to slice(0, 3)
        ],
      };

      const result = generateKeywords(portInfo, null);

      expect(result).toContain('dependencies');
      expect(result).toContain('boost');
      expect(result).toContain('qt');
      expect(result).not.toContain('fourth');
    });

    it('should remove duplicate keywords', () => {
      const portInfo: VcpkgPortInfo = {
        name: 'boost-package',
        version: '1.0.0',
        description: 'A boost package',
        dependencies: ['boost-algorithm', 'boost-filesystem'],
      };

      const upstreamRepo: GitHubRepository = {
        id: 123,
        name: 'boost',
        full_name: 'boostorg/boost',
        owner: {
          login: 'boostorg',
          id: 456,
          avatar_url: 'https://avatars.githubusercontent.com/u/456',
          type: 'Organization',
        },
        private: false,
        html_url: 'https://github.com/boostorg/boost',
        language: 'C++',
        topics: ['cpp', 'boost'], // 'cpp' and 'boost' are duplicates
        stargazers_count: 5000,
        watchers_count: 5000,
        forks_count: 1000,
      };

      const result = generateKeywords(portInfo, upstreamRepo);

      // Should only contain 'boost' once
      const boostCount = result.filter(keyword => keyword === 'boost').length;
      expect(boostCount).toBe(1);

      // Should only contain 'cpp' once (either from topics or basic keywords)
      const cppCount = result.filter(keyword => keyword === 'cpp').length;
      expect(cppCount).toBe(1);
    });

    it('should handle empty dependencies array', () => {
      const portInfo: VcpkgPortInfo = {
        name: 'simple-package',
        version: '1.0.0',
        description: 'A simple package',
        dependencies: [],
      };

      const result = generateKeywords(portInfo, null);

      expect(result).not.toContain('dependencies');
      expect(result).toEqual(['vcpkg', 'cpp', 'c++', 'native']);
    });

    it('should handle missing topics array', () => {
      const portInfo: VcpkgPortInfo = {
        name: 'test-package',
        version: '1.0.0',
        description: 'A test package',
      };

      const upstreamRepo: GitHubRepository = {
        id: 123,
        name: 'test',
        full_name: 'test/test',
        owner: {
          login: 'testuser',
          id: 456,
          avatar_url: 'https://avatars.githubusercontent.com/u/456',
          type: 'User',
        },
        private: false,
        html_url: 'https://github.com/test/test',
        language: 'C++',
        // topics is missing
        stargazers_count: 100,
        watchers_count: 100,
        forks_count: 10,
      };

      const result = generateKeywords(portInfo, upstreamRepo);

      expect(result).toContain('c++');
      expect(result).toContain('vcpkg');
    });
  });

  describe('getLicense', () => {
    it('should return license name from upstream repository', () => {
      const upstreamRepo: GitHubRepository = {
        id: 123,
        name: 'test',
        full_name: 'test/test',
        owner: {
          login: 'testuser',
          id: 456,
          avatar_url: 'https://avatars.githubusercontent.com/u/456',
          type: 'User',
        },
        private: false,
        html_url: 'https://github.com/test/test',
        language: 'C++',
        license: {
          key: 'mit',
          name: 'MIT License',
          spdx_id: 'MIT',
          url: 'https://api.github.com/licenses/mit',
        },
        stargazers_count: 100,
        watchers_count: 100,
        forks_count: 10,
      };

      const result = getLicense(upstreamRepo);

      expect(result).toBe('MIT License');
    });

    it('should return undefined when upstream repo is null', () => {
      const result = getLicense(null);

      expect(result).toBeUndefined();
    });

    it('should return undefined when license is missing', () => {
      const upstreamRepo: GitHubRepository = {
        id: 123,
        name: 'test',
        full_name: 'test/test',
        owner: {
          login: 'testuser',
          id: 456,
          avatar_url: 'https://avatars.githubusercontent.com/u/456',
          type: 'User',
        },
        private: false,
        html_url: 'https://github.com/test/test',
        language: 'C++',
        // license is missing
        stargazers_count: 100,
        watchers_count: 100,
        forks_count: 10,
      };

      const result = getLicense(upstreamRepo);

      expect(result).toBeUndefined();
    });

    it('should return undefined when license name is empty', () => {
      const upstreamRepo: GitHubRepository = {
        id: 123,
        name: 'test',
        full_name: 'test/test',
        owner: {
          login: 'testuser',
          id: 456,
          avatar_url: 'https://avatars.githubusercontent.com/u/456',
          type: 'User',
        },
        private: false,
        html_url: 'https://github.com/test/test',
        language: 'C++',
        license: {
          key: 'unknown',
          name: '', // Empty name
          spdx_id: null,
          url: null,
        },
        stargazers_count: 100,
        watchers_count: 100,
        forks_count: 10,
      };

      const result = getLicense(upstreamRepo);

      expect(result).toBeUndefined();
    });

    it('should handle various license types', () => {
      const licenseTypes = [
        'MIT License',
        'Apache License 2.0',
        'GNU General Public License v3.0',
        'BSD 3-Clause "New" or "Revised" License',
        'Mozilla Public License 2.0',
      ];

      licenseTypes.forEach(licenseName => {
        const upstreamRepo: GitHubRepository = {
          id: 123,
          name: 'test',
          full_name: 'test/test',
          owner: {
            login: 'testuser',
            id: 456,
            avatar_url: 'https://avatars.githubusercontent.com/u/456',
            type: 'User',
          },
          private: false,
          html_url: 'https://github.com/test/test',
          language: 'C++',
          license: {
            key: 'test',
            name: licenseName,
            spdx_id: 'TEST',
            url: 'https://example.com',
          },
          stargazers_count: 100,
          watchers_count: 100,
          forks_count: 10,
        };

        const result = getLicense(upstreamRepo);
        expect(result).toBe(licenseName);
      });
    });
  });

  describe('getMaintainers', () => {
    it('should return default maintainers when upstream repo is null', () => {
      const result = getMaintainers(null);

      expect(result).toEqual(['vcpkg team']);
    });

    it('should include upstream repo owner when available', () => {
      const upstreamRepo: GitHubRepository = {
        id: 123,
        name: 'test',
        full_name: 'test/test',
        owner: {
          login: 'microsoft',
          id: 456,
          avatar_url: 'https://avatars.githubusercontent.com/u/456',
          type: 'Organization',
        },
        private: false,
        html_url: 'https://github.com/microsoft/test',
        language: 'C++',
        stargazers_count: 1000,
        watchers_count: 1000,
        forks_count: 200,
      };

      const result = getMaintainers(upstreamRepo);

      expect(result).toEqual(['vcpkg team', 'microsoft']);
    });

    it('should handle missing owner', () => {
      const upstreamRepo = {
        id: 123,
        name: 'test',
        full_name: 'test/test',
        // owner is missing
        private: false,
        html_url: 'https://github.com/test/test',
        language: 'C++',
        stargazers_count: 100,
        watchers_count: 100,
        forks_count: 10,
      } as GitHubRepository;

      const result = getMaintainers(upstreamRepo);

      expect(result).toEqual(['vcpkg team']);
    });

    it('should handle empty owner login', () => {
      const upstreamRepo: GitHubRepository = {
        id: 123,
        name: 'test',
        full_name: 'test/test',
        owner: {
          login: '', // Empty login
          id: 456,
          avatar_url: 'https://avatars.githubusercontent.com/u/456',
          type: 'User',
        },
        private: false,
        html_url: 'https://github.com/test/test',
        language: 'C++',
        stargazers_count: 100,
        watchers_count: 100,
        forks_count: 10,
      };

      const result = getMaintainers(upstreamRepo);

      expect(result).toEqual(['vcpkg team']);
    });

    it('should handle various organization types', () => {
      const organizations = ['microsoft', 'google', 'facebook', 'boostorg', 'opencv'];

      organizations.forEach(orgName => {
        const upstreamRepo: GitHubRepository = {
          id: 123,
          name: 'test',
          full_name: `${orgName}/test`,
          owner: {
            login: orgName,
            id: 456,
            avatar_url: `https://avatars.githubusercontent.com/u/456`,
            type: 'Organization',
          },
          private: false,
          html_url: `https://github.com/${orgName}/test`,
          language: 'C++',
          stargazers_count: 1000,
          watchers_count: 1000,
          forks_count: 200,
        };

        const result = getMaintainers(upstreamRepo);
        expect(result).toEqual(['vcpkg team', orgName]);
      });
    });

    it('should always include vcpkg team as first maintainer', () => {
      const upstreamRepo: GitHubRepository = {
        id: 123,
        name: 'test',
        full_name: 'randomuser/test',
        owner: {
          login: 'randomuser',
          id: 456,
          avatar_url: 'https://avatars.githubusercontent.com/u/456',
          type: 'User',
        },
        private: false,
        html_url: 'https://github.com/randomuser/test',
        language: 'C++',
        stargazers_count: 10,
        watchers_count: 10,
        forks_count: 2,
      };

      const result = getMaintainers(upstreamRepo);

      expect(result[0]).toBe('vcpkg team');
      expect(result).toContain('randomuser');
    });
  });

  describe('integration tests', () => {
    it('should work together to generate comprehensive package metadata', () => {
      const portInfo: VcpkgPortInfo = {
        name: 'boost-filesystem',
        version: '1.82.0',
        description: 'Boost.Filesystem library',
        dependencies: ['boost-system', 'boost-config'],
      };

      const portfileInfo: VcpkgPortfileInfo = {
        vcpkg_from_github: {
          owner: 'boostorg',
          repo: 'boost',
          ref: 'boost-1.82.0',
          sha512: 'abcdef123456',
        },
      };

      const upstreamRepo: GitHubRepository = {
        id: 12345,
        name: 'boost',
        full_name: 'boostorg/boost',
        owner: {
          login: 'boostorg',
          id: 67890,
          avatar_url: 'https://avatars.githubusercontent.com/u/67890',
          type: 'Organization',
        },
        private: false,
        html_url: 'https://github.com/boostorg/boost',
        description: 'Super-project for modularized Boost',
        language: 'C++',
        topics: ['cpp', 'boost', 'header-only', 'libraries'],
        license: {
          key: 'bsl-1.0',
          name: 'Boost Software License 1.0',
          spdx_id: 'BSL-1.0',
          url: 'https://api.github.com/licenses/bsl-1.0',
        },
        stargazers_count: 5000,
        watchers_count: 5000,
        forks_count: 1500,
      };

      // Test all helper functions together
      const repositoryInfo = generateRepositoryInfo(portfileInfo);
      const author = getAuthor(portInfo, upstreamRepo);
      const keywords = generateKeywords(portInfo, upstreamRepo);
      const license = getLicense(upstreamRepo);
      const maintainers = getMaintainers(upstreamRepo);

      expect(repositoryInfo).toEqual({
        type: 'git',
        url: 'https://github.com/boostorg/boost',
      });

      expect(author).toBe('boostorg');

      expect(keywords).toContain('vcpkg');
      expect(keywords).toContain('cpp');
      expect(keywords).toContain('c++');
      expect(keywords).toContain('boost');
      expect(keywords).toContain('dependencies');
      expect(keywords).toContain('header-only');
      expect(keywords).toContain('libraries');

      expect(license).toBe('Boost Software License 1.0');

      expect(maintainers).toEqual(['vcpkg team', 'boostorg']);
    });
  });
});