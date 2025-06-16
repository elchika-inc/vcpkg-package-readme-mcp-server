import type { CacheEntry, CacheStats } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    maxSize: parseInt(process.env.CACHE_MAX_SIZE || '104857600'), // 100MB
  };
  private defaultTtl = parseInt(process.env.CACHE_TTL || '3600') * 1000; // 1 hour in ms

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      logger.debug('Cache miss', { key });
      return null;
    }

    // Check if entry has expired
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      this.updateSize();
      this.stats.misses++;
      logger.debug('Cache expired', { key });
      return null;
    }

    this.stats.hits++;
    logger.debug('Cache hit', { key });
    return entry.data;
  }

  set<T>(key: string, data: T, ttl = this.defaultTtl): void {
    // Estimate size (rough approximation)
    const dataSize = this.estimateSize(data);
    
    // Check if adding this would exceed max size
    if (this.stats.size + dataSize > this.stats.maxSize) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };

    this.cache.set(key, entry);
    this.updateSize();
    logger.debug('Cache set', { key, ttl });
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    // Check if entry has expired
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      this.updateSize();
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.updateSize();
      logger.debug('Cache delete', { key });
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
    logger.debug('Cache cleared');
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  private estimateSize(data: any): number {
    // Rough estimation of memory usage
    try {
      return JSON.stringify(data).length * 2; // Approximate bytes (2 bytes per character)
    } catch {
      return 1000; // Default estimate if JSON.stringify fails
    }
  }

  private updateSize(): void {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += this.estimateSize(entry);
    }
    this.stats.size = totalSize;
  }

  private evictLRU(): void {
    // Simple LRU: remove the oldest entry based on timestamp
    let oldestKey: string | null = null;
    let oldestTimestamp = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      logger.debug('Cache LRU eviction', { key: oldestKey });
    }
  }

  // Cleanup expired entries
  cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
    }

    if (expiredKeys.length > 0) {
      this.updateSize();
      logger.debug('Cache cleanup', { expiredCount: expiredKeys.length });
    }
  }
}

// Singleton cache instance
export const cache = new MemoryCache();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  cache.cleanup();
}, 5 * 60 * 1000);