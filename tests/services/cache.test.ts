import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MemoryCache } from '../../src/services/cache.js';

describe('MemoryCache', () => {
  let cache: MemoryCache;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables for consistent testing
    process.env.CACHE_MAX_SIZE = '1000000'; // 1MB
    process.env.CACHE_TTL = '3600'; // 1 hour
    cache = new MemoryCache();
  });

  afterEach(() => {
    cache.clear();
  });

  describe('basic operations', () => {
    it('should store and retrieve data', () => {
      const testData = { name: 'test-package', version: '1.0.0' };
      cache.set('test-key', testData);
      
      const result = cache.get('test-key');
      expect(result).toEqual(testData);
    });

    it('should return null for non-existent keys', () => {
      const result = cache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should check if key exists', () => {
      cache.set('exists', 'data');
      
      expect(cache.has('exists')).toBe(true);
      expect(cache.has('not-exists')).toBe(false);
    });

    it('should delete entries', () => {
      cache.set('to-delete', 'data');
      expect(cache.has('to-delete')).toBe(true);
      
      const deleted = cache.delete('to-delete');
      expect(deleted).toBe(true);
      expect(cache.has('to-delete')).toBe(false);
    });

    it('should return false when deleting non-existent key', () => {
      const deleted = cache.delete('not-exists');
      expect(deleted).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'data1');
      cache.set('key2', 'data2');
      
      cache.clear();
      
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(false);
      expect(cache.getStats().size).toBe(0);
    });
  });

  describe('TTL and expiration', () => {
    it('should expire entries after TTL', () => {
      const shortTtl = 10; // 10ms
      cache.set('expire-test', 'data', shortTtl);
      
      expect(cache.get('expire-test')).toBe('data');
      
      // Wait for expiration
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(cache.get('expire-test')).toBeNull();
          expect(cache.has('expire-test')).toBe(false);
          resolve();
        }, 20);
      });
    });

    it('should use default TTL when not specified', () => {
      cache.set('default-ttl', 'data');
      expect(cache.has('default-ttl')).toBe(true);
    });

    it('should cleanup expired entries', () => {
      const shortTtl = 10; // 10ms
      cache.set('cleanup1', 'data1', shortTtl);
      cache.set('cleanup2', 'data2', shortTtl);
      cache.set('keep', 'data3', 60000); // 1 minute
      
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          cache.cleanup();
          
          expect(cache.has('cleanup1')).toBe(false);
          expect(cache.has('cleanup2')).toBe(false);
          expect(cache.has('keep')).toBe(true);
          resolve();
        }, 20);
      });
    });
  });

  describe('statistics', () => {
    it('should track cache hits and misses', () => {
      cache.set('stats-test', 'data');
      
      // Hit
      cache.get('stats-test');
      // Miss
      cache.get('non-existent');
      
      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    it('should count expired entries as misses', () => {
      const shortTtl = 10; // 10ms
      cache.set('expire-miss', 'data', shortTtl);
      
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          cache.get('expire-miss');
          
          const stats = cache.getStats();
          expect(stats.misses).toBeGreaterThan(0);
          resolve();
        }, 20);
      });
    });

    it('should track cache size', () => {
      const initialStats = cache.getStats();
      expect(initialStats.size).toBe(0);
      
      cache.set('size-test', 'some data');
      
      const updatedStats = cache.getStats();
      expect(updatedStats.size).toBeGreaterThan(0);
    });

    it('should return copy of stats to prevent mutation', () => {
      const stats1 = cache.getStats();
      const stats2 = cache.getStats();
      
      expect(stats1).not.toBe(stats2); // Different objects
      expect(stats1).toEqual(stats2); // Same content
    });
  });

  describe('size management and LRU eviction', () => {
    it('should estimate data size', () => {
      const smallData = 'small';
      const largeData = 'x'.repeat(1000);
      
      cache.set('small', smallData);
      cache.set('large', largeData);
      
      const stats = cache.getStats();
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should handle JSON.stringify errors gracefully', () => {
      const circularObj: any = {};
      circularObj.self = circularObj;
      
      // Should not throw error
      expect(() => cache.set('circular', circularObj)).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle storing null and undefined', () => {
      cache.set('null-test', null);
      cache.set('undefined-test', undefined);
      
      expect(cache.get('null-test')).toBeNull();
      expect(cache.get('undefined-test')).toBeUndefined();
    });

    it('should handle storing complex objects', () => {
      const complexData = {
        packages: [
          { name: 'pkg1', versions: ['1.0.0', '2.0.0'] },
          { name: 'pkg2', dependencies: { dep1: '^1.0.0' } }
        ],
        metadata: {
          total: 2,
          timestamp: new Date().toISOString()
        }
      };
      
      cache.set('complex', complexData);
      const result = cache.get('complex');
      
      expect(result).toEqual(complexData);
    });

    it('should handle empty string keys', () => {
      cache.set('', 'empty-key-data');
      expect(cache.get('')).toBe('empty-key-data');
    });
  });
});