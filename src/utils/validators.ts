import { 
  validatePackageName, 
  validateVersion, 
  validateSearchQuery, 
  validateLimit, 
  validateScore 
} from './error-handler.js';

import type {
  GetPackageReadmeParams,
  GetPackageInfoParams,
  SearchPackagesParams,
} from '../types/index.js';

export function validateGetPackageReadmeParams(params: GetPackageReadmeParams): void {
  validatePackageName(params.package_name);
  
  if (params.version !== undefined) {
    validateVersion(params.version);
  }
  
  // include_examples is boolean, no validation needed beyond type checking
}

export function validateGetPackageInfoParams(params: GetPackageInfoParams): void {
  validatePackageName(params.package_name);
  
  // include_dependencies and include_dev_dependencies are booleans, no validation needed beyond type checking
}

export function validateSearchPackagesParams(params: SearchPackagesParams): void {
  validateSearchQuery(params.query);
  
  if (params.limit !== undefined) {
    validateLimit(params.limit);
  }
  
  if (params.quality !== undefined) {
    validateScore(params.quality, 'quality');
  }
  
  if (params.popularity !== undefined) {
    validateScore(params.popularity, 'popularity');
  }
}