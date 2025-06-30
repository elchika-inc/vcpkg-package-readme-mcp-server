import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../../src/utils/logger.js';

describe('Logger', () => {
  let consoleSpy: {
    debug: any;
    info: any;
    warn: any;
    error: any;
  };

  beforeEach(() => {
    // Mock console methods
    consoleSpy = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    // Restore console methods
    vi.restoreAllMocks();
  });

  describe('basic logging functionality', () => {
    it('should log warn and error messages by default', () => {
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');
      
      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.info).not.toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalled();
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should format messages with timestamp and level', () => {
      logger.warn('test message');
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[WARN\] test message$/)
      );
    });

    it('should include context when provided', () => {
      const context = { userId: 123, action: 'test' };
      logger.error('Error occurred', context);
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Error occurred {"userId":123,"action":"test"}')
      );
    });

    it('should handle empty context objects', () => {
      logger.warn('Warning with empty context', {});
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('Warning with empty context {}')
      );
    });

    it('should handle messages without context', () => {
      logger.error('Simple error message');
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringMatching(/\[ERROR\] Simple error message$/)
      );
    });
  });

  describe('timestamp validation', () => {
    it('should generate valid ISO timestamps', () => {
      logger.error('Timestamp test');
      
      const call = consoleSpy.error.mock.calls[0][0];
      const timestampMatch = call.match(/^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\]/);
      
      expect(timestampMatch).not.toBeNull();
      
      const timestamp = timestampMatch![1];
      const date = new Date(timestamp);
      
      expect(date.toISOString()).toBe(timestamp);
    });

    it('should generate recent timestamps', () => {
      const beforeLog = Date.now();
      logger.warn('Recent timestamp test');
      const afterLog = Date.now();
      
      const call = consoleSpy.warn.mock.calls[0][0];
      const timestampMatch = call.match(/^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\]/);
      
      const logTimestamp = new Date(timestampMatch![1]).getTime();
      
      expect(logTimestamp).toBeGreaterThanOrEqual(beforeLog);
      expect(logTimestamp).toBeLessThanOrEqual(afterLog);
    });
  });

  describe('edge cases', () => {
    it('should handle empty messages', () => {
      logger.warn('');
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringMatching(/\[WARN\] $/)
      );
    });

    it('should handle complex context objects', () => {
      const complexContext = {
        user: { id: 1, name: 'Test' },
        data: [1, 2, 3],
        nested: { deep: { value: 'test' } }
      };
      
      logger.error('Complex context', complexContext);
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining(JSON.stringify(complexContext))
      );
    });

    it('should handle null and undefined in context', () => {
      const context = {
        nullValue: null,
        undefinedValue: undefined,
        validValue: 'test'
      };
      
      logger.warn('Null/undefined test', context);
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining(JSON.stringify(context))
      );
    });
  });
});