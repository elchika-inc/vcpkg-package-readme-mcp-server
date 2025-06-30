import { describe, it, expect, beforeEach } from 'vitest';
import { ReadmeParser } from '../../src/services/readme-parser.js';
import type { UsageExample } from '../../src/types/index.js';

describe('ReadmeParser', () => {
  let parser: ReadmeParser;

  beforeEach(() => {
    parser = new ReadmeParser();
  });

  describe('parseUsageExamples', () => {
    it('should parse basic usage examples from markdown', () => {
      const readmeContent = `# Boost Library

## Usage

Here's how to use boost:

\`\`\`cpp
#include <boost/algorithm.hpp>
int main() {
    return 0;
}
\`\`\`

## Installation

Install via vcpkg:

\`\`\`cmake
find_package(Boost REQUIRED)
\`\`\`
`;

      const examples = parser.parseUsageExamples(readmeContent);

      expect(examples.length).toBeGreaterThan(0);
      
      const cppExample = examples.find(ex => ex.language === 'cpp');
      expect(cppExample).toBeDefined();
      expect(cppExample?.code).toContain('#include <boost/algorithm.hpp>');
      
      const cmakeExample = examples.find(ex => ex.language === 'cmake');
      expect(cmakeExample).toBeDefined();
      expect(cmakeExample?.code).toContain('find_package(Boost REQUIRED)');
    });

    it('should handle code blocks without language specification', () => {
      const readmeContent = `## Example

\`\`\`
#include <iostream>
int main() { return 0; }
\`\`\`
`;

      const examples = parser.parseUsageExamples(readmeContent);

      expect(examples).toHaveLength(1);
      expect(examples[0].language).toBe('text');
      expect(examples[0].code).toBe('#include <iostream>\nint main() { return 0; }');
    });

    it('should extract inline CMake examples', () => {
      const readmeContent = `# Package

To use this package, add find_package(MyLib REQUIRED) to your CMakeLists.txt.

Also include: #include <mylib/core.h>
`;

      const examples = parser.parseUsageExamples(readmeContent);

      const cmakeExample = examples.find(ex => ex.title === 'CMake Integration');
      const includeExample = examples.find(ex => ex.title === 'Include Headers');
      
      expect(cmakeExample).toBeDefined();
      expect(cmakeExample?.language).toBe('cmake');
      
      expect(includeExample).toBeDefined();
      expect(includeExample?.language).toBe('cpp');
    });

    it('should deduplicate identical examples', () => {
      const readmeContent = `## Usage

\`\`\`cpp
#include <lib.h>
\`\`\`

## Example

\`\`\`cpp
#include <lib.h>
\`\`\`
`;

      const examples = parser.parseUsageExamples(readmeContent);

      expect(examples).toHaveLength(1);
      expect(examples[0].code).toBe('#include <lib.h>');
    });

    it('should handle malformed markdown gracefully', () => {
      const readmeContent = `# Title
## Usage
\`\`\`cpp
#include <test.h>
// Missing closing code block
## Another Section
`;

      const examples = parser.parseUsageExamples(readmeContent);

      // Should not crash
      expect(Array.isArray(examples)).toBe(true);
    });
  });

  describe('isUsageSection', () => {
    it('should identify usage-related sections', () => {
      const usageSections = [
        'usage', 'examples', 'example', 'quick start', 'quickstart',
        'getting started', 'how to use', 'tutorial', 'guide',
        'basic usage', 'simple example', 'sample code',
        'integration', 'installation', 'cmake', 'vcpkg'
      ];

      usageSections.forEach(section => {
        expect(parser['isUsageSection'](section)).toBe(true);
        expect(parser['isUsageSection'](section.toUpperCase())).toBe(true);
      });
    });

    it('should not identify non-usage sections', () => {
      const nonUsageSections = [
        'license', 'changelog', 'contributors', 'api reference',
        'internal details', 'development', 'building from source'
      ];

      nonUsageSections.forEach(section => {
        expect(parser['isUsageSection'](section)).toBe(false);
      });
    });
  });

  describe('generateTitle', () => {
    it('should generate proper titles from section names', () => {
      expect(parser['generateTitle']('usage')).toBe('Usage');
      expect(parser['generateTitle']('quick start')).toBe('Quick Start');
      expect(parser['generateTitle']('getting started')).toBe('Getting Started');
    });

    it('should handle empty and single word inputs', () => {
      expect(parser['generateTitle']('')).toBe('');
      expect(parser['generateTitle']('example')).toBe('Example');
    });
  });

  describe('normalizeLanguage', () => {
    it('should normalize C++ language variants', () => {
      const cppVariants = ['cpp', 'c++', 'cxx', 'cc'];
      cppVariants.forEach(variant => {
        expect(parser['normalizeLanguage'](variant)).toBe('cpp');
        expect(parser['normalizeLanguage'](variant.toUpperCase())).toBe('cpp');
      });
    });

    it('should normalize shell language variants', () => {
      const shellVariants = ['bash', 'sh', 'shell'];
      shellVariants.forEach(variant => {
        expect(parser['normalizeLanguage'](variant)).toBe('bash');
      });
    });

    it('should handle unknown languages', () => {
      expect(parser['normalizeLanguage']('unknown-lang')).toBe('unknown-lang');
      expect(parser['normalizeLanguage']('rust')).toBe('rust');
    });

    it('should handle empty input', () => {
      expect(parser['normalizeLanguage']('')).toBe('text');
      expect(parser['normalizeLanguage']('text')).toBe('text');
    });
  });

  describe('extractDescription', () => {
    it('should extract description after first header', () => {
      const readmeContent = `# Boost Library

Boost provides free peer-reviewed portable C++ source libraries.
We emphasize libraries that work well with the C++ Standard Library.

## Installation

Install instructions here.
`;

      const description = parser.extractDescription(readmeContent);

      expect(description).toBe('Boost provides free peer-reviewed portable C++ source libraries.\nWe emphasize libraries that work well with the C++ Standard Library.');
    });

    it('should skip badges and images', () => {
      const readmeContent = `# Package Name

[![Build Status](https://travis-ci.org/user/repo.svg)](https://travis-ci.org/user/repo)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

This is the actual description of the package.

## Features
`;

      const description = parser.extractDescription(readmeContent);

      expect(description).toBe('This is the actual description of the package.');
      expect(description).not.toContain('[![Build Status]');
      expect(description).not.toContain('![License]');
    });

    it('should handle README without headers', () => {
      const readmeContent = `This is a simple description without headers.
It spans multiple lines.
`;

      const description = parser.extractDescription(readmeContent);

      expect(description).toBe('This is a simple description without headers.\nIt spans multiple lines.');
    });

    it('should return empty string for header-only content', () => {
      const readmeContent = `# Main Title
## Subtitle
### Another Header
`;

      const description = parser.extractDescription(readmeContent);

      expect(description).toBe('');
    });
  });

  describe('cleanupContent', () => {
    it('should remove badges', () => {
      const content = `# Package

[![Build Status](https://travis-ci.org/user/repo.svg?branch=master)](https://travis-ci.org/user/repo)

This is the content.
`;

      const cleaned = parser.cleanupContent(content);

      expect(cleaned).not.toContain('[![Build Status]');
      expect(cleaned).toContain('This is the content.');
    });

    it('should remove HTML comments', () => {
      const content = `# Package

<!-- This is a comment -->
This is visible content.
<!-- Another 
multiline
comment -->
More content.
`;

      const cleaned = parser.cleanupContent(content);

      expect(cleaned).not.toContain('<!-- This is a comment -->');
      expect(cleaned).not.toContain('multiline');
      expect(cleaned).toContain('This is visible content.');
      expect(cleaned).toContain('More content.');
    });

    it('should reduce excessive whitespace', () => {
      const content = `# Package



This has too many newlines.




End of content.
`;

      const cleaned = parser.cleanupContent(content);

      expect(cleaned).not.toMatch(/\n{3,}/);
      expect(cleaned).toContain('This has too many newlines.');
    });

    it('should convert relative links to absolute GitHub links', () => {
      const content = `# Package

See [documentation](docs/README.md) and [examples](examples/basic.cpp).
Also check [this external link](https://example.com).
`;

      const cleaned = parser.cleanupContent(content);

      expect(cleaned).toContain('[documentation](https://github.com/Microsoft/vcpkg/blob/master/docs/README.md)');
      expect(cleaned).toContain('[examples](https://github.com/Microsoft/vcpkg/blob/master/examples/basic.cpp)');
      expect(cleaned).toContain('[this external link](https://example.com)'); // Should not change absolute links
    });

    it('should trim whitespace from final result', () => {
      const content = `   

# Package

Content here.

   `;

      const cleaned = parser.cleanupContent(content);

      expect(cleaned).not.toMatch(/^\s/);
      expect(cleaned).not.toMatch(/\s$/);
    });
  });
});