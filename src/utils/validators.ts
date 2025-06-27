import { ValidationError, InvalidPackageNameError, InvalidVersionError } from '@elchika-inc/package-readme-shared';
import type {
  GetPackageReadmeParams,
  GetPackageInfoParams,
  SearchPackagesParams,
} from '../types/index.js';

export function validateGetPackageReadmeParams(args: unknown): GetPackageReadmeParams {
  if (!args || typeof args !== 'object') {
    throw new ValidationError('args', args, 'object', 'vcpkg');
  }

  const params = args as Record<string, unknown>;

  if (!params.package_name || typeof params.package_name !== 'string') {
    throw new ValidationError('package_name', params.package_name, 'string (required)', 'vcpkg');
  }

  if (params.package_name === '') {
    throw new ValidationError('package_name', params.package_name, 'non-empty string', 'vcpkg');
  }

  if (params.version !== undefined && typeof params.version !== 'string') {
    throw new InvalidVersionError(String(params.version), 'vcpkg');
  }

  if (params.include_examples !== undefined && typeof params.include_examples !== 'boolean') {
    throw new ValidationError('include_examples', params.include_examples, 'boolean', 'vcpkg');
  }

  return {
    package_name: params.package_name,
    version: params.version as string | undefined,
    include_examples: params.include_examples as boolean | undefined,
  };
}

export function validateGetPackageInfoParams(args: unknown): GetPackageInfoParams {
  if (!args || typeof args !== 'object') {
    throw new ValidationError('args', args, 'object', 'vcpkg');
  }

  const params = args as Record<string, unknown>;

  if (!params.package_name || typeof params.package_name !== 'string') {
    throw new ValidationError('package_name', params.package_name, 'string (required)', 'vcpkg');
  }

  if (params.package_name === '') {
    throw new ValidationError('package_name', params.package_name, 'non-empty string', 'vcpkg');
  }

  if (params.include_dependencies !== undefined && typeof params.include_dependencies !== 'boolean') {
    throw new ValidationError('include_dependencies', params.include_dependencies, 'boolean', 'vcpkg');
  }

  if (params.include_dev_dependencies !== undefined && typeof params.include_dev_dependencies !== 'boolean') {
    throw new ValidationError('include_dev_dependencies', params.include_dev_dependencies, 'boolean', 'vcpkg');
  }

  return {
    package_name: params.package_name,
    include_dependencies: params.include_dependencies as boolean | undefined,
    include_dev_dependencies: params.include_dev_dependencies as boolean | undefined,
  };
}

export function validateSearchPackagesParams(args: unknown): SearchPackagesParams {
  if (!args || typeof args !== 'object') {
    throw new ValidationError('args', args, 'object', 'vcpkg');
  }

  const params = args as Record<string, unknown>;

  if (!params.query || typeof params.query !== 'string') {
    throw new ValidationError('query', params.query, 'string (required)', 'vcpkg');
  }

  if (params.query === '') {
    throw new ValidationError('query', params.query, 'non-empty string', 'vcpkg');
  }

  if (params.limit !== undefined) {
    if (typeof params.limit !== 'number' || params.limit < 1 || params.limit > 250) {
      throw new ValidationError('limit', params.limit, 'number between 1 and 250', 'vcpkg');
    }
  }

  if (params.quality !== undefined) {
    if (typeof params.quality !== 'number' || params.quality < 0 || params.quality > 1) {
      throw new ValidationError('quality', params.quality, 'number between 0 and 1', 'vcpkg');
    }
  }

  if (params.popularity !== undefined) {
    if (typeof params.popularity !== 'number' || params.popularity < 0 || params.popularity > 1) {
      throw new ValidationError('popularity', params.popularity, 'number between 0 and 1', 'vcpkg');
    }
  }

  return {
    query: params.query,
    limit: params.limit as number | undefined,
    quality: params.quality as number | undefined,
    popularity: params.popularity as number | undefined,
  };
}