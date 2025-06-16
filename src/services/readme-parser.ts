import type { UsageExample } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class ReadmeParser {
  parseUsageExamples(readmeContent: string): UsageExample[] {
    const examples: UsageExample[] = [];
    
    try {
      // Split content into lines for processing
      const lines = readmeContent.split('\n');
      let currentSection = '';
      let inCodeBlock = false;
      let currentCode = '';
      let currentLanguage = '';
      let currentTitle = '';
      let currentDescription = '';
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] || '';
        
        // Detect section headers
        if (line.match(/^#{1,6}\s+/)) {
          const header = line.replace(/^#{1,6}\s+/, '').toLowerCase();
          currentSection = header;
          
          // Check if this is a usage-related section
          if (this.isUsageSection(header)) {
            currentTitle = line.replace(/^#{1,6}\s+/, '');
            currentDescription = '';
          }
          continue;
        }
        
        // Start of code block
        if (line.startsWith('```')) {
          if (!inCodeBlock) {
            inCodeBlock = true;
            currentLanguage = line.substring(3).trim() || 'text';
            currentCode = '';
          } else {
            // End of code block
            inCodeBlock = false;
            
            if (currentCode.trim() && this.isUsageSection(currentSection)) {
              examples.push({
                title: currentTitle || this.generateTitle(currentSection),
                description: currentDescription || undefined,
                code: currentCode.trim(),
                language: this.normalizeLanguage(currentLanguage),
              });
            }
            
            currentCode = '';
            currentLanguage = '';
          }
          continue;
        }
        
        // Collect code content
        if (inCodeBlock) {
          currentCode += (currentCode ? '\n' : '') + line;
          continue;
        }
        
        // Collect description content
        if (this.isUsageSection(currentSection) && line.trim() && !line.startsWith('#')) {
          currentDescription += (currentDescription ? '\n' : '') + line;
        }
      }
      
      // Also look for inline code examples with specific patterns
      examples.push(...this.extractInlineExamples(readmeContent));
      
    } catch (error) {
      logger.error('Failed to parse README for usage examples', { error });
    }
    
    return this.deduplicateExamples(examples);
  }

  private isUsageSection(sectionName: string): boolean {
    const usageSections = [
      'usage', 'examples', 'example', 'quick start', 'quickstart',
      'getting started', 'how to use', 'tutorial', 'guide',
      'basic usage', 'simple example', 'sample code',
      'integration', 'installation', 'cmake', 'vcpkg',
    ];
    
    return usageSections.some(section => 
      sectionName.includes(section) || section.includes(sectionName)
    );
  }

  private generateTitle(sectionName: string): string {
    // Generate a title based on the section name
    return sectionName.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private normalizeLanguage(language: string): string {
    const languageMap: Record<string, string> = {
      'cpp': 'cpp',
      'c++': 'cpp',
      'cxx': 'cpp',
      'cc': 'cpp',
      'c': 'c',
      'cmake': 'cmake',
      'bash': 'bash',
      'sh': 'bash',
      'shell': 'bash',
      'powershell': 'powershell',
      'ps1': 'powershell',
      'json': 'json',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'makefile': 'makefile',
      'make': 'makefile',
      'dockerfile': 'dockerfile',
      'text': 'text',
      'txt': 'text',
      '': 'text',
    };
    
    const normalized = language.toLowerCase().trim();
    return languageMap[normalized] || normalized;
  }

  private extractInlineExamples(content: string): UsageExample[] {
    const examples: UsageExample[] = [];
    
    // Look for CMakeLists.txt patterns
    const cmakePatterns = [
      /find_package\([^)]+\)/gi,
      /target_link_libraries\([^)]+\)/gi,
      /vcpkg_install\([^)]+\)/gi,
    ];
    
    for (const pattern of cmakePatterns) {
      const matches = content.match(pattern);
      if (matches) {
        for (const match of matches) {
          if (match.length > 10) { // Avoid very short matches
            examples.push({
              title: 'CMake Integration',
              code: match,
              language: 'cmake',
            });
          }
        }
      }
    }
    
    // Look for C++ include patterns
    const includePattern = /#include\s*[<"][^>"]+[>"]/gi;
    const includeMatches = content.match(includePattern);
    if (includeMatches && includeMatches.length > 0) {
      const includeCode = includeMatches.slice(0, 5).join('\n'); // Max 5 includes
      examples.push({
        title: 'Include Headers',
        code: includeCode,
        language: 'cpp',
      });
    }
    
    return examples;
  }

  private deduplicateExamples(examples: UsageExample[]): UsageExample[] {
    const seen = new Set<string>();
    const unique: UsageExample[] = [];
    
    for (const example of examples) {
      const key = `${example.title}:${example.code}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(example);
      }
    }
    
    return unique;
  }

  extractDescription(readmeContent: string): string {
    try {
      const lines = readmeContent.split('\n');
      let description = '';
      let foundFirstHeader = false;
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Skip empty lines at the beginning
        if (!trimmedLine && !description) {
          continue;
        }
        
        // Skip badges and images at the beginning
        if (trimmedLine.startsWith('[![') || trimmedLine.startsWith('![')) {
          continue;
        }
        
        // First header - use as title, don't include in description
        if (trimmedLine.startsWith('#') && !foundFirstHeader) {
          foundFirstHeader = true;
          continue;
        }
        
        // Stop at second header
        if (trimmedLine.startsWith('#') && foundFirstHeader) {
          break;
        }
        
        // Add non-empty lines to description
        if (trimmedLine) {
          description += (description ? '\n' : '') + trimmedLine;
        }
      }
      
      return description.trim();
    } catch (error) {
      logger.error('Failed to extract description from README', { error });
      return '';
    }
  }

  cleanupContent(content: string): string {
    try {
      // Remove badges
      content = content.replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, '');
      
      // Remove HTML comments
      content = content.replace(/<!--[\s\S]*?-->/g, '');
      
      // Remove excessive whitespace
      content = content.replace(/\n{3,}/g, '\n\n');
      
      // Convert relative links to absolute GitHub links
      content = content.replace(
        /\[([^\]]+)\]\((?!https?:\/\/)([^)]+)\)/g,
        '[$1](https://github.com/Microsoft/vcpkg/blob/master/$2)'
      );
      
      return content.trim();
    } catch (error) {
      logger.error('Failed to cleanup README content', { error });
      return content;
    }
  }
}

export const readmeParser = new ReadmeParser();