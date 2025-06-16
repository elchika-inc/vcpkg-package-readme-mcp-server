import { PackageReadmeMcpError } from '../types/index.js';
import { logger } from './logger.js';

export function createError(
  code: string,
  message: string,
  details?: Record<string, unknown>
): PackageReadmeMcpError {
  return new PackageReadmeMcpError(code, message, details);
}

export function handleApiError(error: unknown, context: string): PackageReadmeMcpError {
  logger.error(`API error in ${context}`, { error });

  if (error instanceof Error) {
    // Handle fetch errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return createError('NETWORK_ERROR', `Network error in ${context}: ${error.message}`);
    }

    // Handle AbortError (timeout)
    if (error.name === 'AbortError') {
      return createError('TIMEOUT_ERROR', `Request timeout in ${context}`);
    }

    // Handle generic errors
    return createError('API_ERROR', `API error in ${context}: ${error.message}`);
  }

  return createError('UNKNOWN_ERROR', `Unknown error in ${context}: ${String(error)}`);
}

export function handleHttpError(response: Response, context: string): PackageReadmeMcpError {
  const { status, statusText } = response;

  switch (status) {
    case 404:
      return createError('NOT_FOUND', `Resource not found in ${context}`);
    case 403:
      return createError('FORBIDDEN', `Access forbidden in ${context}. Check API token.`);
    case 429:
      return createError('RATE_LIMIT_EXCEEDED', `Rate limit exceeded in ${context}`);
    case 500:
    case 502:
    case 503:
    case 504:
      return createError('SERVER_ERROR', `Server error in ${context}: ${status} ${statusText}`);
    default:
      return createError('HTTP_ERROR', `HTTP error in ${context}: ${status} ${statusText}`);
  }
}

export function validatePackageName(packageName: string): void {
  if (!packageName || typeof packageName !== 'string') {
    throw createError('INVALID_PACKAGE_NAME', 'Package name must be a non-empty string');
  }

  if (packageName.trim() !== packageName) {
    throw createError('INVALID_PACKAGE_NAME', 'Package name cannot have leading or trailing whitespace');
  }

  // Vcpkg package names are typically lowercase with hyphens
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(packageName)) {
    throw createError('INVALID_PACKAGE_NAME', 'Package name must contain only lowercase letters, numbers, and hyphens');
  }
}

export function validateVersion(version: string): void {
  if (!version || typeof version !== 'string') {
    throw createError('INVALID_VERSION', 'Version must be a non-empty string');
  }

  // Allow 'latest' or valid version formats
  if (version === 'latest') {
    return;
  }

  // Basic version validation - allow various formats used in vcpkg
  if (!/^[\w.-]+$/.test(version)) {
    throw createError('INVALID_VERSION', 'Version contains invalid characters');
  }
}

export function validateSearchQuery(query: string): void {
  if (!query || typeof query !== 'string') {
    throw createError('INVALID_SEARCH_QUERY', 'Search query must be a non-empty string');
  }

  if (query.trim().length === 0) {
    throw createError('INVALID_SEARCH_QUERY', 'Search query cannot be empty or whitespace only');
  }

  if (query.length > 200) {
    throw createError('INVALID_SEARCH_QUERY', 'Search query is too long (max 200 characters)');
  }
}

export function validateLimit(limit: number): void {
  if (!Number.isInteger(limit) || limit < 1 || limit > 250) {
    throw createError('INVALID_LIMIT', 'Limit must be an integer between 1 and 250');
  }
}

export function validateScore(score: number, name: string): void {
  if (typeof score !== 'number' || score < 0 || score > 1) {
    throw createError('INVALID_SCORE', `${name} must be a number between 0 and 1`);
  }
}