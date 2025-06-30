import { describe, it, expect, beforeEach } from 'vitest';
import { VcpkgPackageReadmeMcpServer } from '../src/server.js';

describe('VcpkgPackageReadmeMcpServer', () => {
  let server: VcpkgPackageReadmeMcpServer;

  beforeEach(() => {
    server = new VcpkgPackageReadmeMcpServer();
  });

  describe('constructor', () => {
    it('should create server instance', () => {
      expect(server).toBeInstanceOf(VcpkgPackageReadmeMcpServer);
    });
  });

  describe('getToolDefinitions', () => {
    it('should return all tool definitions', () => {
      const definitions = server['getToolDefinitions']();
      
      expect(definitions).toHaveProperty('get_readme_from_vcpkg');
      expect(definitions).toHaveProperty('get_package_info_from_vcpkg');
      expect(definitions).toHaveProperty('search_packages_from_vcpkg');
      
      expect(Object.keys(definitions)).toHaveLength(3);
    });

    it('should have correct get_readme_from_vcpkg definition', () => {
      const definitions = server['getToolDefinitions']();
      const readmeTool = definitions.get_readme_from_vcpkg;
      
      expect(readmeTool.name).toBe('get_readme_from_vcpkg');
      expect(readmeTool.description).toContain('README');
      expect(readmeTool.description).toContain('vcpkg');
      
      expect(readmeTool.inputSchema.type).toBe('object');
      expect(readmeTool.inputSchema.properties).toHaveProperty('package_name');
      expect(readmeTool.inputSchema.properties).toHaveProperty('version');
      expect(readmeTool.inputSchema.properties).toHaveProperty('include_examples');
      expect(readmeTool.inputSchema.required).toEqual(['package_name']);
      
      // Check property types
      expect(readmeTool.inputSchema.properties.package_name.type).toBe('string');
      expect(readmeTool.inputSchema.properties.version.type).toBe('string');
      expect(readmeTool.inputSchema.properties.version.default).toBe('latest');
      expect(readmeTool.inputSchema.properties.include_examples.type).toBe('boolean');
      expect(readmeTool.inputSchema.properties.include_examples.default).toBe(true);
    });

    it('should have correct get_package_info_from_vcpkg definition', () => {
      const definitions = server['getToolDefinitions']();
      const infoTool = definitions.get_package_info_from_vcpkg;
      
      expect(infoTool.name).toBe('get_package_info_from_vcpkg');
      expect(infoTool.description).toContain('package basic information');
      expect(infoTool.description).toContain('dependencies');
      
      expect(infoTool.inputSchema.properties).toHaveProperty('package_name');
      expect(infoTool.inputSchema.properties).toHaveProperty('include_dependencies');
      expect(infoTool.inputSchema.properties).toHaveProperty('include_dev_dependencies');
      expect(infoTool.inputSchema.required).toEqual(['package_name']);
      
      // Check property types and defaults
      expect(infoTool.inputSchema.properties.include_dependencies.type).toBe('boolean');
      expect(infoTool.inputSchema.properties.include_dependencies.default).toBe(true);
      expect(infoTool.inputSchema.properties.include_dev_dependencies.type).toBe('boolean');
      expect(infoTool.inputSchema.properties.include_dev_dependencies.default).toBe(false);
    });

    it('should have correct search_packages_from_vcpkg definition', () => {
      const definitions = server['getToolDefinitions']();
      const searchTool = definitions.search_packages_from_vcpkg;
      
      expect(searchTool.name).toBe('search_packages_from_vcpkg');
      expect(searchTool.description).toContain('Search for packages');
      expect(searchTool.description).toContain('vcpkg');
      
      expect(searchTool.inputSchema.properties).toHaveProperty('query');
      expect(searchTool.inputSchema.properties).toHaveProperty('limit');
      expect(searchTool.inputSchema.properties).toHaveProperty('quality');
      expect(searchTool.inputSchema.properties).toHaveProperty('popularity');
      expect(searchTool.inputSchema.required).toEqual(['query']);
      
      // Check property types and constraints
      expect(searchTool.inputSchema.properties.query.type).toBe('string');
      
      expect(searchTool.inputSchema.properties.limit.type).toBe('number');
      expect(searchTool.inputSchema.properties.limit.default).toBe(20);
      expect(searchTool.inputSchema.properties.limit.minimum).toBe(1);
      expect(searchTool.inputSchema.properties.limit.maximum).toBe(250);
      
      expect(searchTool.inputSchema.properties.quality.type).toBe('number');
      expect(searchTool.inputSchema.properties.quality.minimum).toBe(0);
      expect(searchTool.inputSchema.properties.quality.maximum).toBe(1);
      
      expect(searchTool.inputSchema.properties.popularity.type).toBe('number');
      expect(searchTool.inputSchema.properties.popularity.minimum).toBe(0);
      expect(searchTool.inputSchema.properties.popularity.maximum).toBe(1);
    });
  });

  describe('handleToolCall', () => {
    it('should throw error for unknown tool', async () => {
      await expect(
        server['handleToolCall']('unknown_tool', {})
      ).rejects.toThrow('Unknown tool: unknown_tool');
    });

    it('should handle empty string tool name', async () => {
      await expect(
        server['handleToolCall']('', {})
      ).rejects.toThrow('Unknown tool: ');
    });

    it('should handle tool names with different casing', async () => {
      await expect(
        server['handleToolCall']('GET_README_FROM_VCPKG', {})
      ).rejects.toThrow('Unknown tool: GET_README_FROM_VCPKG');
      
      await expect(
        server['handleToolCall']('get_readme_from_VCPKG', {})
      ).rejects.toThrow('Unknown tool: get_readme_from_VCPKG');
    });
  });

  describe('tool integration', () => {
    it('should validate all tools have consistent naming', () => {
      const definitions = server['getToolDefinitions']();
      
      // All tool names should end with _from_vcpkg
      Object.keys(definitions).forEach(toolName => {
        expect(toolName).toMatch(/_from_vcpkg$/);
        expect(definitions[toolName].name).toBe(toolName);
      });
    });

    it('should have all required properties in tool schemas', () => {
      const definitions = server['getToolDefinitions']();
      
      Object.values(definitions).forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        
        expect(tool.description).toBeTruthy();
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema).toHaveProperty('properties');
        expect(tool.inputSchema).toHaveProperty('required');
        expect(Array.isArray(tool.inputSchema.required)).toBe(true);
      });
    });

    it('should have consistent package_name property across tools', () => {
      const definitions = server['getToolDefinitions']();
      
      // README and info tools should have package_name as required
      const packageNameTools = ['get_readme_from_vcpkg', 'get_package_info_from_vcpkg'];
      
      packageNameTools.forEach(toolName => {
        const tool = definitions[toolName];
        expect(tool.inputSchema.required).toContain('package_name');
        expect(tool.inputSchema.properties.package_name.type).toBe('string');
        expect(tool.inputSchema.properties.package_name.description).toContain('name');
      });
    });

    it('should have consistent query property for search tool', () => {
      const definitions = server['getToolDefinitions']();
      const searchTool = definitions.search_packages_from_vcpkg;
      
      expect(searchTool.inputSchema.required).toContain('query');
      expect(searchTool.inputSchema.properties.query.type).toBe('string');
      expect(searchTool.inputSchema.properties.query.description).toContain('search');
    });

    it('should have appropriate default values', () => {
      const definitions = server['getToolDefinitions']();
      
      // Check that boolean properties have appropriate defaults
      expect(definitions.get_readme_from_vcpkg.inputSchema.properties.include_examples.default).toBe(true);
      expect(definitions.get_package_info_from_vcpkg.inputSchema.properties.include_dependencies.default).toBe(true);
      expect(definitions.get_package_info_from_vcpkg.inputSchema.properties.include_dev_dependencies.default).toBe(false);
      
      // Check that limit has reasonable default
      expect(definitions.search_packages_from_vcpkg.inputSchema.properties.limit.default).toBe(20);
    });
  });
});