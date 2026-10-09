/**
 * Built-in Tools Command Handler
 * Displays all available built-in browser automation tools
 */

export interface BuiltinTool {
  name: string;
  description: string;
  category: string;
  parameters?: string[];
}

/**
 * Built-in tools registry
 * These are the 26 core browser automation tools available in Endorphin AI
 */
const BUILTIN_TOOLS: BuiltinTool[] = [
  // Navigation Tools (2)
  {
    name: 'navigate',
    description: 'Navigate to URLs and handle page routing',
    category: 'Navigation',
    parameters: ['url: string', 'options?: NavigationOptions'],
  },
  {
    name: 'navigateBack',
    description: 'Navigate back in browser history',
    category: 'Navigation',
  },

  // Content Analysis Tools (1)
  {
    name: 'getPageContent',
    description: 'Get raw HTML page content (CSS classes, data attributes, IDs not in accessibility tree)',
    category: 'Content Analysis',
    parameters: ['includeTitle?: boolean', 'maxLength?: number'],
  },

  // Interaction Tools (9)
  {
    name: 'click',
    description: 'Click on elements using various selectors (CSS, text, role)',
    category: 'Interaction',
    parameters: [
      'selector: string',
      'strategy?: "css" | "text" | "role"',
      'options?: ClickOptions',
    ],
  },
  {
    name: 'fill',
    description: 'Fill input fields with text',
    category: 'Interaction',
    parameters: ['selector: string', 'text: string', 'options?: FillOptions'],
  },
  {
    name: 'clearField',
    description: 'Clear input field contents',
    category: 'Interaction',
    parameters: ['selector: string', 'options?: ClearOptions'],
  },
  {
    name: 'describe',
    description: 'Describe elements on the page',
    category: 'Interaction',
    parameters: ['selector: string'],
  },
  {
    name: 'pressSequentially',
    description: 'Type text character by character',
    category: 'Interaction',
    parameters: ['selector: string', 'text: string'],
  },
  {
    name: 'hover',
    description: 'Hover over elements to trigger hover states',
    category: 'Interaction',
    parameters: ['selector: string'],
  },
  {
    name: 'pressKey',
    description: 'Press keyboard keys (Enter, Tab, Escape, etc.)',
    category: 'Interaction',
    parameters: ['key: string', 'selector?: string'],
  },
  {
    name: 'selectOption',
    description: 'Select an option from a dropdown/select element',
    category: 'Interaction',
    parameters: ['selector: string', 'value: string'],
  },
  {
    name: 'drag',
    description: 'Drag an element to another location',
    category: 'Interaction',
    parameters: ['sourceSelector: string', 'targetSelector: string'],
  },

  // Scroll Tools (1)
  {
    name: 'scroll',
    description: 'Scroll the page or a specific element',
    category: 'Scroll',
    parameters: ['direction: string', 'selector?: string', 'amount?: number'],
  },

  // File Upload Tools (1)
  {
    name: 'fileUpload',
    description: 'Upload files to file input elements',
    category: 'File Upload',
    parameters: ['selector: string', 'filePath: string'],
  },

  // Evaluate Tools (1)
  {
    name: 'evaluate',
    description: 'Execute JavaScript in the browser context',
    category: 'Evaluate',
    parameters: ['script: string'],
  },

  // Network Tools (1)
  {
    name: 'networkRequests',
    description: 'Inspect network requests made by the page',
    category: 'Network',
    parameters: ['filter?: string'],
  },

  // Tab Management Tools (1)
  {
    name: 'tabs',
    description: 'Manage browser tabs (list, switch, close, create)',
    category: 'Tabs',
    parameters: ['action: string', 'tabId?: number'],
  },

  // Verification Tools (6)
  {
    name: 'verifyElement',
    description: 'Verify element state (visible, hidden, enabled, disabled, etc.)',
    category: 'Verification',
    parameters: ['selector: string', 'state: ElementState', 'timeout?: number'],
  },
  {
    name: 'getElementInfo',
    description: 'Get detailed information about elements (text, attributes, properties)',
    category: 'Verification',
    parameters: ['selector: string', 'properties?: string[]'],
  },
  {
    name: 'verifyTextContent',
    description: 'Verify specific text content is visible on the page',
    category: 'Verification',
    parameters: ['text: string', 'exact?: boolean', 'timeout?: number'],
  },
  {
    name: 'verifyTitle',
    description: 'Verify the page title matches or contains expected text',
    category: 'Verification',
    parameters: ['title: string', 'exact?: boolean', 'timeout?: number'],
  },
  {
    name: 'verifyURL',
    description: 'Verify the page URL matches or contains expected URL',
    category: 'Verification',
    parameters: ['url: string', 'exact?: boolean', 'timeout?: number'],
  },
  {
    name: 'verifyListVisible',
    description: 'Verify a list of items are all visible on the page',
    category: 'Verification',
    parameters: ['items: string[]', 'container?: string'],
  },

  // Utility Tools (3)
  {
    name: 'wait',
    description: 'Wait for specific conditions or time delays',
    category: 'Utilities',
    parameters: ['condition: WaitCondition | number', 'timeout?: number'],
  },
  {
    name: 'screenshot',
    description: 'Take screenshots for test documentation and debugging',
    category: 'Utilities',
    parameters: ['description?: string', 'options?: ScreenshotOptions'],
  },
  {
    name: 'resize',
    description: 'Resize the browser viewport',
    category: 'Utilities',
    parameters: ['width: number', 'height: number'],
  },
];

/**
 * Handle list tools command - shows all built-in tools
 */
export function handleListToolsCommand(options: { verbose?: boolean } = {}): void {
  console.log('🛠️  Built-in Browser Automation Tools\n');

  // Group tools by category
  const categories = [...new Set(BUILTIN_TOOLS.map((tool) => tool.category))];

  categories.forEach((category) => {
    const categoryTools = BUILTIN_TOOLS.filter((tool) => tool.category === category);
    const categoryIcon = getCategoryIcon(category);

    console.log(
      `${categoryIcon} ${category} (${categoryTools.length} tool${categoryTools.length === 1 ? '' : 's'})`
    );

    categoryTools.forEach((tool) => {
      if (options.verbose) {
        console.log(`  ${tool.name.padEnd(20)} ${tool.description}`);
        if (tool.parameters) {
          console.log(`    Parameters: ${tool.parameters.join(', ')}`);
        }
        console.log('');
      } else {
        console.log(`  ${tool.name.padEnd(20)} ${tool.description}`);
      }
    });

    console.log('');
  });

  // Summary
  console.log(`📊 Total: ${BUILTIN_TOOLS.length} built-in tools available`);

  if (!options.verbose) {
    console.log('\n💡 Use --verbose flag for detailed tool parameters and usage information');
  }

  console.log('\n📖 Documentation: These tools are automatically available in all tests');
  console.log('   Example: await click("button[data-testid=\\"submit\\"]");');
}

/**
 * Get category icon for display
 */
function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    Navigation: '📍',
    'Content Analysis': '📄',
    Interaction: '🖱️',
    Scroll: '📜',
    'File Upload': '📁',
    Evaluate: '⚡',
    Network: '🌐',
    Tabs: '📑',
    Verification: '✅',
    Utilities: '⚙️',
  };

  return icons[category] || '🔧';
}

/**
 * Get tool count by category
 */
export function getToolStats(): Record<string, number> {
  const stats: Record<string, number> = {};

  BUILTIN_TOOLS.forEach((tool) => {
    stats[tool.category] = (stats[tool.category] || 0) + 1;
  });

  return stats;
}

/**
 * Get all built-in tools list (for programmatic access)
 */
export function getAllBuiltinTools(): BuiltinTool[] {
  return [...BUILTIN_TOOLS];
}

/**
 * Check if a tool exists
 */
export function isValidTool(toolName: string): boolean {
  return BUILTIN_TOOLS.some((tool) => tool.name === toolName);
}
