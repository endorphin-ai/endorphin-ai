/**
 * Centralized Icon Definitions
 * Emoji and symbols used across the framework
 */

export const ICONS = {
  // Status icons
  success: '✅',
  failure: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  debug: '🐞',
  
  // Component icons
  brain: '🧠',      // Agent/AI processing
  gear: '⚙️',       // Tool execution
  robot: '🤖',      // Robot/automation
  money: '💰',      // Token/cost tracking
  
  // Action icons
  target: '🎯',     // Target-specific messages
  rocket: '🚀',     // Launch/startup messages
  lightning: '⚡', // Performance/speed messages
  search: '🔍',     // Search operations
  globe: '🌍',      // Global/network operations
  web: '🌐',        // Web/internet operations
  bulb: '💡',       // Ideas/insights
  movie: '🎬',      // Recording/playback
  refresh: '🔄',    // Refresh/reload operations
  party: '🎉',      // Celebration/completion
  stop: '🛑',       // Stop/halt operations
  finish: '🏁',     // Finish/completion
  tools: '🛠️',      // Tools/toolbox
  
  // Content icons
  page: '📄',       // Page-related operations
  memo: '📝',       // Documentation/notes
  chart: '📊',      // Analytics/metrics
  folder: '📁',     // File/folder operations
  tag: '🏷️',       // Tags/labels
  picture: '🖼️',    // Picture/image/screenshot operations
  camera: '📸',     // Camera/capture operations
  
  // Tool/technical icons
  wrench: '🔧',     // Technical/repair operations
  cleanup: '🧹',    // Cleanup operations
  clock: '⏰',      // Time-related operations
  hourglass: '⏳',  // Wait/delay operations
  testTube: '🧪',   // Testing-related
  button: '🔘',     // Button/click operations
  lock: '🔒',       // Security/locked operations
  keyboard: '⌨️',   // Keyboard/input operations
  
  // Console reporter icons (simpler variants)
  checkmark: '✓',   // Simple success (console reporter)
  cross: '✗',       // Simple failure (console reporter)
  circle: '○',      // Skipped (console reporter)
  dot: '●',         // Running (console reporter)
  warningSimple: '⚠', // Simple warning (console reporter)
} as const;

export type IconName = keyof typeof ICONS;

// Helper function to get icon
export const getIcon = (name: IconName): string => {
  return ICONS[name];
};

// Semantic icon helpers
export const icons = {
  // Status
  success: () => ICONS.success,
  failure: () => ICONS.failure,
  warning: () => ICONS.warning,
  info: () => ICONS.info,
  
  // Components
  agent: () => ICONS.brain,
  tool: () => ICONS.gear,
  tokens: () => ICONS.money,
  
  // Actions
  launch: () => ICONS.rocket,
  target: () => ICONS.target,
  search: () => ICONS.search,
  web: () => ICONS.web,
  idea: () => ICONS.bulb,
  record: () => ICONS.movie,
  refresh: () => ICONS.refresh,
  celebrate: () => ICONS.party,
  stop: () => ICONS.stop,
  finish: () => ICONS.finish,
  click: () => ICONS.button,
  secure: () => ICONS.lock,
  type: () => ICONS.keyboard,
  
  // Console reporter
  passed: () => ICONS.checkmark,
  failed: () => ICONS.cross,
  skipped: () => ICONS.circle,
  running: () => ICONS.dot,
};