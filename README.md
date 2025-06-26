# vcpkg Package README MCP Server

[![license](https://img.shields.io/npm/l/vcpkg-package-readme-mcp-server)](https://github.com/elchika-inc/vcpkg-package-readme-mcp-server/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/vcpkg-package-readme-mcp-server)](https://www.npmjs.com/package/vcpkg-package-readme-mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/vcpkg-package-readme-mcp-server)](https://www.npmjs.com/package/vcpkg-package-readme-mcp-server)
[![GitHub stars](https://img.shields.io/github/stars/elchika-inc/vcpkg-package-readme-mcp-server)](https://github.com/elchika-inc/vcpkg-package-readme-mcp-server)

An MCP (Model Context Protocol) server that enables AI assistants to fetch comprehensive information about vcpkg packages from the vcpkg registry, including README content, package metadata, and search functionality.

## Features

- **Package README Retrieval**: Fetch formatted README content with usage examples from C++/vcpkg packages hosted in the vcpkg registry
- **Package Information**: Get comprehensive package metadata including dependencies, versions, statistics, and maintainer information
- **Package Search**: Search vcpkg registry with advanced filtering by package type, popularity, and relevance
- **Smart Caching**: Intelligent caching system to optimize API usage and improve response times
- **GitHub Integration**: Seamless integration with GitHub API for enhanced README fetching when packages link to GitHub repositories
- **Error Handling**: Robust error handling with automatic retry logic and fallback strategies

## MCP Client Configuration

Add this server to your MCP client configuration:

```json
{
  "mcpServers": {
    "vcpkg-package-readme": {
      "command": "npx",
      "args": ["vcpkg-package-readme-mcp-server"],
      "env": {
        "GITHUB_TOKEN": "your_github_token_here"
      }
    }
  }
}
```

> **Note**: The `GITHUB_TOKEN` is optional but recommended for higher API rate limits when fetching README content from GitHub.

## Available Tools

### get_package_readme

Retrieves comprehensive README content and usage examples for vcpkg packages.

**Parameters:**
```json
{
  "package_name": "boost",
  "version": "latest",
  "include_examples": true
}
```

- `package_name` (string, required): vcpkg package name
- `version` (string, optional): Specific package version or "latest" (default: "latest")
- `include_examples` (boolean, optional): Include usage examples and code snippets (default: true)

**Returns:** Formatted README content with installation instructions, usage examples, and API documentation.

### get_package_info

Fetches detailed package metadata, dependencies, and statistics from vcpkg registry.

**Parameters:**
```json
{
  "package_name": "opencv",
  "include_dependencies": true,
  "include_dev_dependencies": false
}
```

- `package_name` (string, required): vcpkg package name
- `include_dependencies` (boolean, optional): Include runtime dependencies (default: true)
- `include_dev_dependencies` (boolean, optional): Include development dependencies (default: false)

**Returns:** Package metadata including version info, maintainers, license, platform support, and dependency tree.

### search_packages

Searches vcpkg registry for packages with advanced filtering capabilities.

**Parameters:**
```json
{
  "query": "json parser",
  "limit": 20,
  "quality": 0.8
}
```

- `query` (string, required): Search terms (package name, description, keywords)
- `limit` (number, optional): Maximum number of results to return (default: 20, max: 250)
- `quality` (number, optional): Minimum quality score filter (0-1)

**Returns:** List of matching packages with names, descriptions, platform support, and relevance scores.

## Error Handling

The server handles common error scenarios gracefully:

- **Package not found**: Returns clear error messages with package name suggestions
- **Rate limiting**: Implements automatic retry with exponential backoff
- **Network timeouts**: Configurable timeout with retry logic
- **Invalid package names**: Validates package name format and provides guidance
- **GitHub API failures**: Fallback strategies when GitHub integration fails

## License

MIT