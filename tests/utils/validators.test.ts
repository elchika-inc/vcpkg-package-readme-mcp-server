import { describe, it, expect } from 'vitest';
import {
  validateGetPackageReadmeParams,
  validateGetPackageInfoParams,
  validateSearchPackagesParams,
} from '../../src/utils/validators.js';
// Mock the shared package errors
class ValidationError extends Error {
  field: string;
  value: unknown;
  expected: string;
  context: string;

  constructor(field: string, value: unknown, expected: string, context: string) {
    super(`Invalid ${field}: expected ${expected}, got ${typeof value} in ${context}`);
    this.field = field;
    this.value = value;
    this.expected = expected;
    this.context = context;
    this.name = 'ValidationError';
  }
}

class InvalidVersionError extends Error {
  constructor(version: string, context: string) {
    super(`Invalid version: ${version} in ${context}`);
    this.name = 'InvalidVersionError';
  }
}

vi.mock('@elchika-inc/package-readme-shared', () => ({
  ValidationError,
  InvalidVersionError,
}));

describe('validators', () => {
  describe('validateGetPackageReadmeParams', () => {
    it('should validate valid parameters', () => {
      const validParams = {
        package_name: 'boost',
        version: '1.82.0',
        include_examples: true,
      };

      const result = validateGetPackageReadmeParams(validParams);
      
      expect(result).toEqual({
        package_name: 'boost',
        version: '1.82.0',
        include_examples: true,
      });
    });

    it('should validate minimal parameters', () => {
      const minimalParams = {
        package_name: 'opencv',
      };

      const result = validateGetPackageReadmeParams(minimalParams);
      
      expect(result).toEqual({
        package_name: 'opencv',
        version: undefined,
        include_examples: undefined,
      });
    });

    it('should throw ValidationError for null/undefined args', () => {
      expect(() => validateGetPackageReadmeParams(null)).toThrow(ValidationError);
      expect(() => validateGetPackageReadmeParams(undefined)).toThrow(ValidationError);
    });

    it('should throw ValidationError for non-object args', () => {
      expect(() => validateGetPackageReadmeParams('string')).toThrow(ValidationError);
      expect(() => validateGetPackageReadmeParams(123)).toThrow(ValidationError);
      expect(() => validateGetPackageReadmeParams([])).toThrow(ValidationError);
    });

    it('should throw ValidationError for missing package_name', () => {
      expect(() => validateGetPackageReadmeParams({})).toThrow(ValidationError);
      expect(() => validateGetPackageReadmeParams({ package_name: null })).toThrow(ValidationError);
      expect(() => validateGetPackageReadmeParams({ package_name: undefined })).toThrow(ValidationError);
    });

    it('should throw ValidationError for non-string package_name', () => {
      expect(() => validateGetPackageReadmeParams({ package_name: 123 })).toThrow(ValidationError);
      expect(() => validateGetPackageReadmeParams({ package_name: {} })).toThrow(ValidationError);
      expect(() => validateGetPackageReadmeParams({ package_name: [] })).toThrow(ValidationError);
    });

    it('should throw ValidationError for empty package_name', () => {
      expect(() => validateGetPackageReadmeParams({ package_name: '' })).toThrow(ValidationError);
    });

    it('should throw InvalidVersionError for non-string version', () => {
      expect(() => validateGetPackageReadmeParams({ 
        package_name: 'boost', 
        version: 123 
      })).toThrow(InvalidVersionError);
      expect(() => validateGetPackageReadmeParams({ 
        package_name: 'boost', 
        version: {} 
      })).toThrow(InvalidVersionError);
    });

    it('should throw ValidationError for non-boolean include_examples', () => {
      expect(() => validateGetPackageReadmeParams({ 
        package_name: 'boost', 
        include_examples: 'true' 
      })).toThrow(ValidationError);
      expect(() => validateGetPackageReadmeParams({ 
        package_name: 'boost', 
        include_examples: 1 
      })).toThrow(ValidationError);
    });

    it('should handle valid version strings', () => {
      const testCases = ['1.82.0', 'master', 'latest', '2023.01.15'];
      
      testCases.forEach(version => {
        const result = validateGetPackageReadmeParams({ 
          package_name: 'boost', 
          version 
        });
        expect(result.version).toBe(version);
      });
    });
  });

  describe('validateGetPackageInfoParams', () => {
    it('should validate valid parameters', () => {
      const validParams = {
        package_name: 'zlib',
        include_dependencies: true,
        include_dev_dependencies: false,
      };

      const result = validateGetPackageInfoParams(validParams);
      
      expect(result).toEqual({
        package_name: 'zlib',
        include_dependencies: true,
        include_dev_dependencies: false,
      });
    });

    it('should validate minimal parameters', () => {
      const minimalParams = {
        package_name: 'curl',
      };

      const result = validateGetPackageInfoParams(minimalParams);
      
      expect(result).toEqual({
        package_name: 'curl',
        include_dependencies: undefined,
        include_dev_dependencies: undefined,
      });
    });

    it('should throw ValidationError for null/undefined args', () => {
      expect(() => validateGetPackageInfoParams(null)).toThrow(ValidationError);
      expect(() => validateGetPackageInfoParams(undefined)).toThrow(ValidationError);
    });

    it('should throw ValidationError for non-object args', () => {
      expect(() => validateGetPackageInfoParams('string')).toThrow(ValidationError);
      expect(() => validateGetPackageInfoParams(123)).toThrow(ValidationError);
    });

    it('should throw ValidationError for missing package_name', () => {
      expect(() => validateGetPackageInfoParams({})).toThrow(ValidationError);
      expect(() => validateGetPackageInfoParams({ package_name: null })).toThrow(ValidationError);
    });

    it('should throw ValidationError for empty package_name', () => {
      expect(() => validateGetPackageInfoParams({ package_name: '' })).toThrow(ValidationError);
    });

    it('should throw ValidationError for non-boolean include_dependencies', () => {
      expect(() => validateGetPackageInfoParams({ 
        package_name: 'zlib', 
        include_dependencies: 'true' 
      })).toThrow(ValidationError);
      expect(() => validateGetPackageInfoParams({ 
        package_name: 'zlib', 
        include_dependencies: 1 
      })).toThrow(ValidationError);
    });

    it('should throw ValidationError for non-boolean include_dev_dependencies', () => {
      expect(() => validateGetPackageInfoParams({ 
        package_name: 'zlib', 
        include_dev_dependencies: 'false' 
      })).toThrow(ValidationError);
      expect(() => validateGetPackageInfoParams({ 
        package_name: 'zlib', 
        include_dev_dependencies: 0 
      })).toThrow(ValidationError);
    });
  });

  describe('validateSearchPackagesParams', () => {
    it('should validate valid parameters', () => {
      const validParams = {
        query: 'graphics',
        limit: 50,
        quality: 0.8,
        popularity: 0.6,
      };

      const result = validateSearchPackagesParams(validParams);
      
      expect(result).toEqual({
        query: 'graphics',
        limit: 50,
        quality: 0.8,
        popularity: 0.6,
      });
    });

    it('should validate minimal parameters', () => {
      const minimalParams = {
        query: 'networking',
      };

      const result = validateSearchPackagesParams(minimalParams);
      
      expect(result).toEqual({
        query: 'networking',
        limit: undefined,
        quality: undefined,
        popularity: undefined,
      });
    });

    it('should throw ValidationError for null/undefined args', () => {
      expect(() => validateSearchPackagesParams(null)).toThrow(ValidationError);
      expect(() => validateSearchPackagesParams(undefined)).toThrow(ValidationError);
    });

    it('should throw ValidationError for non-object args', () => {
      expect(() => validateSearchPackagesParams('string')).toThrow(ValidationError);
      expect(() => validateSearchPackagesParams(123)).toThrow(ValidationError);
    });

    it('should throw ValidationError for missing query', () => {
      expect(() => validateSearchPackagesParams({})).toThrow(ValidationError);
      expect(() => validateSearchPackagesParams({ query: null })).toThrow(ValidationError);
      expect(() => validateSearchPackagesParams({ query: undefined })).toThrow(ValidationError);
    });

    it('should throw ValidationError for non-string query', () => {
      expect(() => validateSearchPackagesParams({ query: 123 })).toThrow(ValidationError);
      expect(() => validateSearchPackagesParams({ query: {} })).toThrow(ValidationError);
    });

    it('should throw ValidationError for empty query', () => {
      expect(() => validateSearchPackagesParams({ query: '' })).toThrow(ValidationError);
    });

    it('should validate limit boundaries', () => {
      // Valid limits
      const validLimits = [1, 10, 50, 100, 250];
      validLimits.forEach(limit => {
        const result = validateSearchPackagesParams({ query: 'test', limit });
        expect(result.limit).toBe(limit);
      });

      // Invalid limits
      const invalidLimits = [0, -1, 251, 1000, 1.5, 'abc', null];
      invalidLimits.forEach(limit => {
        expect(() => validateSearchPackagesParams({ 
          query: 'test', 
          limit: limit as any 
        })).toThrow(ValidationError);
      });
    });

    it('should validate quality score boundaries', () => {
      // Valid quality scores
      const validScores = [0, 0.1, 0.5, 0.9, 1];
      validScores.forEach(quality => {
        const result = validateSearchPackagesParams({ query: 'test', quality });
        expect(result.quality).toBe(quality);
      });

      // Invalid quality scores
      const invalidScores = [-0.1, 1.1, 2, 'abc', null];
      invalidScores.forEach(quality => {
        expect(() => validateSearchPackagesParams({ 
          query: 'test', 
          quality: quality as any 
        })).toThrow(ValidationError);
      });
    });

    it('should validate popularity score boundaries', () => {
      // Valid popularity scores
      const validScores = [0, 0.2, 0.5, 0.8, 1];
      validScores.forEach(popularity => {
        const result = validateSearchPackagesParams({ query: 'test', popularity });
        expect(result.popularity).toBe(popularity);
      });

      // Invalid popularity scores
      const invalidScores = [-0.1, 1.1, 3, 'xyz', null];
      invalidScores.forEach(popularity => {
        expect(() => validateSearchPackagesParams({ 
          query: 'test', 
          popularity: popularity as any 
        })).toThrow(ValidationError);
      });
    });

    it('should handle complex queries', () => {
      const complexQueries = [
        'graphics library',
        'boost-algorithm',
        'openssl crypto',
        'C++ networking',
      ];

      complexQueries.forEach(query => {
        const result = validateSearchPackagesParams({ query });
        expect(result.query).toBe(query);
      });
    });

    it('should validate all parameters together', () => {
      const complexParams = {
        query: 'machine learning boost',
        limit: 25,
        quality: 0.75,
        popularity: 0.5,
      };

      const result = validateSearchPackagesParams(complexParams);
      expect(result).toEqual(complexParams);
    });
  });

  describe('error messages and types', () => {
    it('should include vcpkg context in ValidationError', () => {
      try {
        validateGetPackageReadmeParams({});
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toContain('vcpkg');
      }
    });

    it('should include vcpkg context in InvalidVersionError', () => {
      try {
        validateGetPackageReadmeParams({ package_name: 'boost', version: 123 });
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidVersionError);
        expect(error.message).toContain('vcpkg');
      }
    });

    it('should preserve original ValidationError properties', () => {
      try {
        validateSearchPackagesParams({ query: 'test', limit: 300 });
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.field).toBe('limit');
        expect(error.value).toBe(300);
        expect(error.expected).toBe('number between 1 and 250');
        expect(error.context).toBe('vcpkg');
      }
    });
  });
});