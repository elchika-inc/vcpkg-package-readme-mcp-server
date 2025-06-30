import { describe, it, expect } from 'vitest';
import {
  createError,
  handleApiError,
  handleHttpError,
  validatePackageName,
  validateVersion,
  validateSearchQuery,
  validateLimit,
  validateScore,
} from '../../src/utils/error-handler.js';
import { PackageReadmeMcpError } from '../../src/types/index.js';

describe('error-handler', () => {
  describe('createError', () => {
    it('should create PackageReadmeMcpError with code and message', () => {
      const error = createError('TEST_ERROR', 'Test error message');
      
      expect(error).toBeInstanceOf(PackageReadmeMcpError);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Test error message');
    });

    it('should create error with details', () => {
      const details = { packageName: 'test-pkg', version: '1.0.0' };
      const error = createError('TEST_ERROR', 'Test error', details);
      
      expect(error.details).toEqual(details);
    });
  });

  describe('handleApiError', () => {
    it('should handle network errors', () => {
      const networkError = new TypeError('fetch failed');
      const error = handleApiError(networkError, 'test-context');
      
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.message).toContain('Network error in test-context');
    });

    it('should handle timeout errors', () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'AbortError';
      const error = handleApiError(timeoutError, 'test-context');
      
      expect(error.code).toBe('TIMEOUT_ERROR');
      expect(error.message).toBe('Request timeout in test-context');
    });

    it('should handle generic errors', () => {
      const genericError = new Error('Some API error');
      const error = handleApiError(genericError, 'test-context');
      
      expect(error.code).toBe('API_ERROR');
      expect(error.message).toContain('API error in test-context');
    });

    it('should handle unknown errors', () => {
      const unknownError = 'string error';
      const error = handleApiError(unknownError, 'test-context');
      
      expect(error.code).toBe('UNKNOWN_ERROR');
      expect(error.message).toContain('Unknown error in test-context');
    });
  });

  describe('handleHttpError', () => {
    function createMockResponse(status: number, statusText = ''): Response {
      return { status, statusText } as Response;
    }

    it('should handle 404 errors', () => {
      const response = createMockResponse(404, 'Not Found');
      const error = handleHttpError(response, 'test-context');
      
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe('Resource not found in test-context');
    });

    it('should handle 403 errors', () => {
      const response = createMockResponse(403, 'Forbidden');
      const error = handleHttpError(response, 'test-context');
      
      expect(error.code).toBe('FORBIDDEN');
      expect(error.message).toContain('Access forbidden in test-context');
    });

    it('should handle 429 errors', () => {
      const response = createMockResponse(429, 'Too Many Requests');
      const error = handleHttpError(response, 'test-context');
      
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.message).toBe('Rate limit exceeded in test-context');
    });

    it('should handle server errors (5xx)', () => {
      const statuses = [500, 502, 503, 504];
      
      statuses.forEach(status => {
        const response = createMockResponse(status, 'Server Error');
        const error = handleHttpError(response, 'test-context');
        
        expect(error.code).toBe('SERVER_ERROR');
        expect(error.message).toContain('Server error in test-context');
      });
    });

    it('should handle other HTTP errors', () => {
      const response = createMockResponse(400, 'Bad Request');
      const error = handleHttpError(response, 'test-context');
      
      expect(error.code).toBe('HTTP_ERROR');
      expect(error.message).toContain('HTTP error in test-context: 400 Bad Request');
    });
  });

  describe('validatePackageName', () => {
    it('should accept valid package names', () => {
      const validNames = ['boost', 'opencv', 'mysql-connector-cpp', 'zlib', 'a', 'x264'];
      
      validNames.forEach(name => {
        expect(() => validatePackageName(name)).not.toThrow();
      });
    });

    it('should reject empty or non-string names', () => {
      const invalidNames = ['', null, undefined, 123, {}];
      
      invalidNames.forEach(name => {
        expect(() => validatePackageName(name as any)).toThrow('Package name must be a non-empty string');
      });
    });

    it('should reject names with whitespace', () => {
      const invalidNames = [' boost', 'boost ', ' boost ', 'boost opencv'];
      
      invalidNames.forEach(name => {
        expect(() => validatePackageName(name)).toThrow();
      });
    });

    it('should reject names with invalid characters', () => {
      const invalidNames = ['BOOST', 'boost_lib', 'boost.lib', 'boost@1.0', '-boost', 'boost-'];
      
      invalidNames.forEach(name => {
        expect(() => validatePackageName(name)).toThrow('Package name must contain only lowercase letters, numbers, and hyphens');
      });
    });
  });

  describe('validateVersion', () => {
    it('should accept valid versions', () => {
      const validVersions = ['latest', '1.0.0', '2.1.3-alpha', 'master', 'v1.2.3', '2023.01.15'];
      
      validVersions.forEach(version => {
        expect(() => validateVersion(version)).not.toThrow();
      });
    });

    it('should reject empty or non-string versions', () => {
      const invalidVersions = ['', null, undefined, 123];
      
      invalidVersions.forEach(version => {
        expect(() => validateVersion(version as any)).toThrow('Version must be a non-empty string');
      });
    });

    it('should reject versions with invalid characters', () => {
      const invalidVersions = ['1.0.0@latest', 'v1.0.0#branch', '1.0.0 beta'];
      
      invalidVersions.forEach(version => {
        expect(() => validateVersion(version)).toThrow('Version contains invalid characters');
      });
    });
  });

  describe('validateSearchQuery', () => {
    it('should accept valid search queries', () => {
      const validQueries = ['boost', 'opencv library', 'mysql-connector', 'a'];
      
      validQueries.forEach(query => {
        expect(() => validateSearchQuery(query)).not.toThrow();
      });
    });

    it('should reject empty or non-string queries', () => {
      const invalidQueries = ['', null, undefined, 123];
      
      invalidQueries.forEach(query => {
        expect(() => validateSearchQuery(query as any)).toThrow('Search query must be a non-empty string');
      });
    });

    it('should reject whitespace-only queries', () => {
      const invalidQueries = [' ', '  ', '\t', '\n'];
      
      invalidQueries.forEach(query => {
        expect(() => validateSearchQuery(query)).toThrow('Search query cannot be empty or whitespace only');
      });
    });

    it('should reject queries that are too long', () => {
      const longQuery = 'a'.repeat(201);
      
      expect(() => validateSearchQuery(longQuery)).toThrow('Search query is too long (max 200 characters)');
    });
  });

  describe('validateLimit', () => {
    it('should accept valid limits', () => {
      const validLimits = [1, 10, 50, 100, 250];
      
      validLimits.forEach(limit => {
        expect(() => validateLimit(limit)).not.toThrow();
      });
    });

    it('should reject invalid limits', () => {
      const invalidLimits = [0, -1, 251, 1000, 1.5, 'abc', null];
      
      invalidLimits.forEach(limit => {
        expect(() => validateLimit(limit as any)).toThrow('Limit must be an integer between 1 and 250');
      });
    });
  });

  describe('validateScore', () => {
    it('should accept valid scores', () => {
      const validScores = [0, 0.5, 1, 0.1, 0.9];
      
      validScores.forEach(score => {
        expect(() => validateScore(score, 'quality')).not.toThrow();
      });
    });

    it('should reject invalid scores', () => {
      const invalidScores = [-0.1, 1.1, 2, 'abc', null, undefined];
      
      invalidScores.forEach(score => {
        expect(() => validateScore(score as any, 'quality')).toThrow('quality must be a number between 0 and 1');
      });
    });

    it('should include score name in error message', () => {
      expect(() => validateScore(2, 'popularity')).toThrow('popularity must be a number between 0 and 1');
    });
  });
});