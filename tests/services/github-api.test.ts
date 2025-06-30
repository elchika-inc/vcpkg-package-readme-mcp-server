import { describe, it, expect, beforeEach } from 'vitest';
import { GitHubApiClient } from '../../src/services/github-api.js';

describe('GitHubApiClient', () => {
  let githubApi: GitHubApiClient;

  beforeEach(() => {
    githubApi = new GitHubApiClient();
  });

  describe('constructor and configuration', () => {
    it('should create GitHubApiClient instance', () => {
      expect(githubApi).toBeInstanceOf(GitHubApiClient);
    });
  });

  describe('parseControlFile', () => {
    it('should parse CONTROL file correctly', () => {
      const controlContent = `Source: boost
Version: 1.82.0
Description: Boost C++ Libraries
Homepage: https://www.boost.org
Build-Depends: vcpkg-cmake, vcpkg-cmake-config`;

      const result = githubApi['parseControlFile'](controlContent, 'boost');
      
      expect(result).toEqual({
        name: 'boost',
        version: '1.82.0',
        description: 'Boost C++ Libraries',
        homepage: 'https://www.boost.org',
        dependencies: ['vcpkg-cmake', 'vcpkg-cmake-config'],
      });
    });

    it('should handle CONTROL file with missing fields', () => {
      const controlContent = `Source: minimal
Description: A minimal package`;

      const result = githubApi['parseControlFile'](controlContent, 'minimal');
      
      expect(result).toEqual({
        name: 'minimal',
        version: 'unknown',
        description: 'A minimal package',
      });
    });

    it('should handle empty Build-Depends', () => {
      const controlContent = `Source: simple
Version: 1.0.0
Description: Simple package
Build-Depends: `;

      const result = githubApi['parseControlFile'](controlContent, 'simple');
      
      expect(result).toEqual({
        name: 'simple',
        version: '1.0.0',
        description: 'Simple package',
        dependencies: [],
      });
    });
  });

  describe('parsePortfile', () => {
    it('should parse portfile with vcpkg_from_github', () => {
      const portfileContent = `vcpkg_from_github(
    OUT_SOURCE_PATH SOURCE_PATH
    REPO boostorg/boost
    REF boost-1.82.0
    SHA512 abc123def456789
    HEAD_REF master
)`;

      const result = githubApi['parsePortfile'](portfileContent);
      
      expect(result).toEqual({
        vcpkg_from_github: {
          owner: 'boostorg',
          repo: 'boost',
          ref: 'boost-1.82.0',
          sha512: 'abc123def456789',
        },
      });
    });

    it('should return empty object for portfile without vcpkg_from_github', () => {
      const portfileContent = `vcpkg_configure_cmake(
    SOURCE_PATH \${SOURCE_PATH}
    OPTIONS
        -DBUILD_TESTING=OFF
)`;

      const result = githubApi['parsePortfile'](portfileContent);
      
      expect(result).toEqual({});
    });

    it('should handle multiline vcpkg_from_github with complex formatting', () => {
      const portfileContent = `vcpkg_from_github(
    OUT_SOURCE_PATH SOURCE_PATH
    REPO        microsoft/vcpkg-tool
    REF         2023-01-15
    SHA512      abcdef123456789abcdef123456789abcdef123456789abcdef123456789abcdef123456789abcdef123456789abcdef123456789abcdef123456789abcdef123456789
    HEAD_REF    main
)`;

      const result = githubApi['parsePortfile'](portfileContent);
      
      expect(result.vcpkg_from_github).toBeDefined();
      expect(result.vcpkg_from_github?.owner).toBe('microsoft');
      expect(result.vcpkg_from_github?.repo).toBe('vcpkg-tool');
      expect(result.vcpkg_from_github?.ref).toBe('2023-01-15');
    });
  });

  describe('basic functionality', () => {
    it('should have all expected methods', () => {
      expect(typeof githubApi.searchPackages).toBe('function');
      expect(typeof githubApi.getFileContent).toBe('function');
      expect(typeof githubApi.getVcpkgPortInfo).toBe('function');
      expect(typeof githubApi.getVcpkgPortfile).toBe('function');
      expect(typeof githubApi.getReadmeContent).toBe('function');
    });

    it('should have private parsing methods', () => {
      expect(typeof githubApi['parseControlFile']).toBe('function');
      expect(typeof githubApi['parsePortfile']).toBe('function');
    });
  });

  describe('error handling', () => {
    it('should handle parsing errors gracefully', () => {
      // Test that parsing methods don't throw on malformed input
      expect(() => githubApi['parseControlFile']('', 'test')).not.toThrow();
      expect(() => githubApi['parsePortfile']('')).not.toThrow();
    });

    it('should handle edge cases in control file parsing', () => {
      const malformedContent = `Source: test
Invalid line without colon
Version:
Description: Test package`;

      const result = githubApi['parseControlFile'](malformedContent, 'test');
      
      expect(result.name).toBe('test');
      expect(result.description).toBe('Test package');
    });
  });
});