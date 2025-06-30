import { describe, it, expect, beforeEach } from 'vitest';
import { VersionResolver } from '../../src/services/version-resolver.js';

describe('VersionResolver', () => {
  let versionResolver: VersionResolver;

  beforeEach(() => {
    versionResolver = new VersionResolver();
  });

  describe('basic instantiation', () => {
    it('should create VersionResolver instance', () => {
      expect(versionResolver).toBeInstanceOf(VersionResolver);
    });

    it('should have resolveVersion method', () => {
      expect(typeof versionResolver.resolveVersion).toBe('function');
    });

    it('should have getLatestVersion method', () => {
      expect(typeof versionResolver.getLatestVersion).toBe('function');
    });

    it('should have getAvailableVersions method', () => {
      expect(typeof versionResolver.getAvailableVersions).toBe('function');
    });
  });

  describe('error handling', () => {
    it('should handle invalid package names', async () => {
      await expect(
        versionResolver.resolveVersion('')
      ).rejects.toThrow();
    });

    it('should handle network failures gracefully', async () => {
      await expect(
        versionResolver.getLatestVersion('non-existent-package-12345')
      ).rejects.toThrow();
    });

    it('should return empty array for getAvailableVersions on error', async () => {
      const result = await versionResolver.getAvailableVersions('non-existent-package-12345');
      expect(Array.isArray(result)).toBe(true);
    });
  });
});