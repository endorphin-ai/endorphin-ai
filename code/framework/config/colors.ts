/**
 * Centralized Color Definitions
 * Terminal color codes used across the framework
 */

export const COLORS = {
  // Basic control codes
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Standard colors
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  
  // Background colors
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  
  // Special combinations
  brightCyan: '\x1b[36m\x1b[1m', // Bright cyan for tools (matches "Running Endorphin AI Tests")
  brightGreen: '\x1b[32m\x1b[1m', // Bright green for success
  brightRed: '\x1b[31m\x1b[1m', // Bright red for failures
  
  // Endorphin brand colors
  purple: '\x1b[95m', // Bright magenta for endorphin/agent messages
  darkPurple: '\x1b[35m',
} as const;

export type ColorName = keyof typeof COLORS;

// Helper function to apply color
export const colorize = (text: string, color: ColorName): string => {
  return `${COLORS[color]}${text}${COLORS.reset}`;
};

// Semantic color helpers
export const colors = {
  error: (text: string) => colorize(text, 'brightRed'),
  success: (text: string) => colorize(text, 'brightGreen'),
  warning: (text: string) => colorize(text, 'yellow'),
  info: (text: string) => colorize(text, 'blue'),
  agent: (text: string) => colorize(text, 'purple'),
  tool: (text: string) => colorize(text, 'brightCyan'),
  dim: (text: string) => colorize(text, 'gray'),
};