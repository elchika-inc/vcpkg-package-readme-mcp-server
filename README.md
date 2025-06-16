# vcpkg Package README MCP Server

A Model Context Protocol (MCP) server that provides tools for fetching vcpkg package information, README content, and usage examples. This server allows AI assistants to help developers discover and understand C++ packages available through the vcpkg package manager.

## Features

- **Package README Retrieval**: Get comprehensive package documentation and usage examples
- **Package Information**: Access detailed package metadata, dependencies, and statistics  
- **Package Search**: Search the vcpkg registry with quality and popularity filtering
- **Smart Caching**: Efficient caching system to minimize API calls
- **GitHub Integration**: Leverages GitHub API to access vcpkg registry data

## Installation

```bash
npm install vcpkg-package-readme-mcp-server
```

## Configuration

### Environment Variables

- `GITHUB_TOKEN` (optional): GitHub personal access token for higher API rate limits
- `LOG_LEVEL` (optional): Set logging level (debug, info, warn, error) - defaults to 'info'
- `CACHE_TTL` (optional): Cache time-to-live in seconds - defaults to 3600 (1 hour)
- `CACHE_MAX_SIZE` (optional): Maximum cache size in bytes - defaults to 104857600 (100MB)
- `REQUEST_TIMEOUT` (optional): Request timeout in milliseconds - defaults to 30000 (30 seconds)

### MCP Client Configuration

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "vcpkg-readme": {
      "command": "node",
      "args": ["/path/to/vcpkg-package-readme-mcp-server/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "your-github-token-here"
      }
    }
  }
}
```

## Available Tools

### get_package_readme

Retrieves package README content and usage examples.

**Parameters:**
- `package_name` (required): Name of the vcpkg package
- `version` (optional): Package version, defaults to "latest"
- `include_examples` (optional): Whether to include usage examples, defaults to true

**Example:**
```json
{
  "package_name": "boost",
  "version": "latest",
  "include_examples": true
}
```

### get_package_info

Gets package metadata, dependencies, and statistics.

**Parameters:**
- `package_name` (required): Name of the vcpkg package
- `include_dependencies` (optional): Include dependency information, defaults to true
- `include_dev_dependencies` (optional): Include development dependencies, defaults to false

**Example:**
```json
{
  "package_name": "opencv",
  "include_dependencies": true
}
```

### search_packages

Searches for packages in the vcpkg registry.

**Parameters:**
- `query` (required): Search query string
- `limit` (optional): Maximum results to return (1-250), defaults to 20
- `quality` (optional): Minimum quality score (0-1)
- `popularity` (optional): Minimum popularity score (0-1)

**Example:**
```json
{
  "query": "json parser",
  "limit": 10,
  "quality": 0.7
}
```

## How It Works

The server uses the GitHub API to access the Microsoft/vcpkg repository, which contains all vcpkg package definitions. For each package:

1. **Package Information**: Extracted from `ports/{package}/vcpkg.json` or legacy `CONTROL` files
2. **Installation Instructions**: Generated based on vcpkg conventions
3. **Dependencies**: Parsed from package metadata
4. **README Content**: Retrieved from port directory or upstream repository
5. **Usage Examples**: Intelligently extracted from README content with vcpkg-specific examples added

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MCP Client    │───▶│   vcpkg MCP     │───▶│   GitHub API    │
│   (Claude etc)  │    │    Server       │    │ (Microsoft/vcpkg)│
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │  Memory Cache   │
                       │   (LRU + TTL)   │
                       └─────────────────┘
```

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev

# Run tests
npm test

# Type checking
npm run typecheck

# Linting
npm run lint
```

## API Rate Limits

The server respects GitHub API rate limits:
- **Without token**: 60 requests per hour
- **With token**: 5,000 requests per hour

The caching system helps minimize API calls and stay within rate limits.

## Error Handling

The server includes comprehensive error handling for:
- Package not found errors
- Network connectivity issues  
- API rate limit exceeded
- Invalid parameter validation
- Upstream repository access issues

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Related Projects

- [npm-package-readme-mcp-server](../npm-package-readme-mcp-server) - Similar server for npm packages
- [composer-package-readme-mcp-server](../composer-package-readme-mcp-server) - Similar server for PHP Composer packages