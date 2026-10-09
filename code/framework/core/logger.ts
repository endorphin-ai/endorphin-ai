/**
 * Centralized Logging System
 * Provides structured logging with different levels, colors, and icons
 */

import { COLORS } from '../config/colors.js';
import { ICONS } from '../config/icons.js';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4,
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: Error;
  component?: string;
  sessionId?: string;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  logFilePath?: string;
  enableStructured: boolean;
  maxLogFileSize?: number; // in bytes
  component?: string;
  enableColors: boolean;
  enableIcons: boolean;
}

export class Logger {
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 1000;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      enableConsole: true,
      enableFile: false,
      enableStructured: false,
      maxLogFileSize: 10 * 1024 * 1024, // 10MB
      enableColors: true,
      enableIcons: true,
      ...config,
    };
  }

  debug(message: string, context?: Record<string, any>, component?: string): void {
    this.log(LogLevel.DEBUG, message, context, undefined, component);
  }

  info(message: string, context?: Record<string, any>, component?: string): void {
    this.log(LogLevel.INFO, message, context, undefined, component);
  }

  warn(message: string, context?: Record<string, any>, component?: string): void {
    this.log(LogLevel.WARN, message, context, undefined, component);
  }

  error(message: string, error?: Error, context?: Record<string, any>, component?: string): void {
    this.log(LogLevel.ERROR, message, context, error, component);
  }

  critical(
    message: string,
    error?: Error,
    context?: Record<string, any>,
    component?: string
  ): void {
    this.log(LogLevel.CRITICAL, message, context, error, component);
  }

  success(message: string, context?: Record<string, any>, component?: string): void {
    this.log(LogLevel.INFO, message, context, undefined, component);
  }


  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error,
    component?: string
  ): void {
    if (level < this.config.level) {
      return; // Skip if below configured level
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: context || {},
      error: error || undefined,
      component: component || this.config.component || undefined,
    } as LogEntry;

    // Add to buffer
    this.logBuffer.push(entry);
    this.trimBuffer();

    // Output to console
    if (this.config.enableConsole) {
      this.logToConsole(entry);
    }

    // Output to file
    if (this.config.enableFile && this.config.logFilePath) {
      this.logToFile(entry);
    }
  }

  private logToConsole(entry: LogEntry): void {
    // Format timestamp to local time HH:MM:SS
    const date = new Date(entry.timestamp);
    const timestamp = date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
    const component = entry.component ? `[${entry.component}]` : '';
    const levelStr = LogLevel[entry.level].padEnd(8);

    // Apply colors based on log level
    let colorCode = '';
    const resetCode = this.config.enableColors ? COLORS.reset : '';
    
    if (this.config.enableColors) {
      switch (entry.level) {
        case LogLevel.ERROR:
        case LogLevel.CRITICAL:
          colorCode = COLORS.brightRed;
          break;
        case LogLevel.WARN:
          colorCode = COLORS.yellow;
          break;
        case LogLevel.INFO:
          // Special handling for ValidationAgent SUCCESS messages
          if (entry.component?.toLowerCase() === 'validationagent' && 
              entry.message.toLowerCase().includes('success')) {
            colorCode = COLORS.brightGreen; // Green for ValidationAgent SUCCESS messages
          } else if (entry.component?.toLowerCase() === 'validationagent' && 
              entry.message.toLowerCase().includes('failed')) {
            colorCode = COLORS.brightRed; // Red for ValidationAgent FAILED messages
          } else if (entry.component?.toLowerCase().includes('agent') || 
              entry.component?.toLowerCase().includes('endorphin') ||
              entry.message.toLowerCase().includes('endorphin')) {
            colorCode = COLORS.purple;
          } else if (entry.component?.toLowerCase() === 'tool') {
            colorCode = COLORS.brightCyan; // Bright cyan for tool components (matches "Running Endorphin AI Tests")
          } else {
            colorCode = COLORS.blue;
          }
          break;
        case LogLevel.DEBUG:
          colorCode = COLORS.gray;
          break;
        default:
          colorCode = COLORS.white;
      }
    }

    // Icons are now included in the message by the caller
    // No need to add icons here since they're part of the message
    let message = `${colorCode}${timestamp} ${levelStr} ${component} ${entry.message}${resetCode}`;

    if (entry.context && Object.keys(entry.context).length > 0) {
      if (this.config.enableStructured) {
        message += ` ${JSON.stringify(entry.context)}`;
      } else {
        const contextStr = Object.entries(entry.context)
          .map(([k, v]) => {
            // Handle different value types properly
            if (v === null) return `${k}=null`;
            if (v === undefined) return `${k}=undefined`;
            if (typeof v === 'object') {
              return `${k}=${JSON.stringify(v)}`;
            }
            return `${k}=${v}`;
          })
          .join(' ');
        message += ` {${contextStr}}`;
      }
    }

    const consoleMethod = this.getConsoleMethod(entry.level);

    if (entry.error) {
      consoleMethod(message, entry.error);
    } else {
      consoleMethod(message);
    }
  }

  private async logToFile(entry: LogEntry): Promise<void> {
    if (!this.config.logFilePath) return;

    try {
      const { promises: fs } = await import('node:fs');
      const logLine = this.config.enableStructured
        ? `${JSON.stringify(entry)  }\n`
        : `${this.formatLogLine(entry)  }\n`;

      await fs.appendFile(this.config.logFilePath, logLine);
    } catch (error) {
      // Fallback to console if file write fails
      console.error('Failed to write to log file:', error);
    }
  }

  private formatLogLine(entry: LogEntry): string {
    const parts = [
      entry.timestamp,
      LogLevel[entry.level],
      entry.component || 'SYSTEM',
      entry.message,
    ];

    if (entry.context) {
      parts.push(JSON.stringify(entry.context));
    }

    if (entry.error) {
      parts.push(`ERROR: ${entry.error.message}`);
      if (entry.error.stack) {
        parts.push(`STACK: ${entry.error.stack}`);
      }
    }

    return parts.join(' | ');
  }

  private getConsoleMethod(level: LogLevel): (...args: any[]) => void {
    switch (level) {
      case LogLevel.DEBUG:
        return console.debug;
      case LogLevel.INFO:
        return console.info;
      case LogLevel.WARN:
        return console.warn;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        return console.error;
      default:
        return console.log;
    }
  }

  private trimBuffer(): void {
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.maxBufferSize);
    }
  }

  // Utility methods
  getRecentLogs(count = 50): LogEntry[] {
    return this.logBuffer.slice(-count);
  }

  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logBuffer.filter((entry) => entry.level === level);
  }

  clearBuffer(): void {
    this.logBuffer = [];
  }

  setLevel(level: LogLevel): void {
    this.config.level = level;
    this.info(`Log level changed to ${LogLevel[level]}`, { newLevel: level });
  }

  createChild(component: string): Logger {
    const childComponent = this.config.component
      ? `${this.config.component}.${component}`
      : component;
    return new Logger({
      ...this.config,
      component: childComponent,
    });
  }

  // Performance logging helpers
  startTimer(label: string): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.debug(`Timer: ${label}`, { duration: `${duration}ms` });
    };
  }

  logMemoryUsage(component?: string): void {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memory = process.memoryUsage();
      this.debug(
        'Memory usage',
        {
          heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`,
          external: `${Math.round(memory.external / 1024 / 1024)}MB`,
          rss: `${Math.round(memory.rss / 1024 / 1024)}MB`,
        },
        component
      );
    }
  }
}

// Helper function to parse log level from environment variables
const parseLogLevel = (): LogLevel => {
  // Check for explicit log level first
  const explicitLevel = process.env.ENDORPHIN_LOG_LEVEL?.toUpperCase();
  if (explicitLevel) {
    switch (explicitLevel) {
      case 'DEBUG': return LogLevel.DEBUG;
      case 'INFO': return LogLevel.INFO;
      case 'WARN': case 'WARNING': return LogLevel.WARN;
      case 'ERROR': return LogLevel.ERROR;
      case 'CRITICAL': return LogLevel.CRITICAL;
    }
  }

  // Check for ENDORPHIN_DEBUG for backward compatibility
  const debugEnv = process.env.ENDORPHIN_DEBUG;
  if (debugEnv === 'true' || debugEnv === 'verbose') {
    return LogLevel.DEBUG;
  }

  // Default based on NODE_ENV
  return process.env.NODE_ENV === 'test' ? LogLevel.WARN : LogLevel.INFO;
};

// Helper function to determine if colors should be enabled
const shouldEnableColors = (): boolean => {
  if (process.env.ENDORPHIN_COLORS !== undefined) {
    return process.env.ENDORPHIN_COLORS.toLowerCase() === 'true';
  }
  // Disable colors in test environment or when NO_COLOR is set
  return process.env.NODE_ENV !== 'test' && !process.env.NO_COLOR;
};

// Helper function to determine if file logging should be enabled
const shouldEnableFileLogging = (): boolean => {
  return process.env.ENDORPHIN_LOG_FILE !== undefined && process.env.ENDORPHIN_LOG_FILE !== '';
};

// Helper function to create logger config
const createLoggerConfig = (component: string): Partial<LoggerConfig> => {
  const config: Partial<LoggerConfig> = {
    level: parseLogLevel(),
    enableConsole: true,
    enableFile: shouldEnableFileLogging(),
    enableStructured: process.env.ENDORPHIN_LOG_FORMAT === 'json',
    enableColors: shouldEnableColors(),
    enableIcons: shouldEnableColors(), // Icons follow color settings
    component,
  };

  // Only set logFilePath if it's defined
  if (process.env.ENDORPHIN_LOG_FILE) {
    config.logFilePath = process.env.ENDORPHIN_LOG_FILE;
  }

  return config;
};

// Global logger instance
export const globalLogger = new Logger(createLoggerConfig('FRAMEWORK'));

// Specialized logger for agent messages
export const agentLogger = new Logger(createLoggerConfig('AGENT'));

// Helper functions for common logging patterns
export const logWithIcon = (level: LogLevel, icon: keyof typeof ICONS, message: string, context?: Record<string, any>, component?: string) => {
  const iconStr = ICONS[icon];
  const fullMessage = `${iconStr} ${message}`;
  
  switch (level) {
    case LogLevel.DEBUG:
      globalLogger.debug(fullMessage, context, component);
      break;
    case LogLevel.INFO:
      globalLogger.info(fullMessage, context, component);
      break;
    case LogLevel.WARN:
      globalLogger.warn(fullMessage, context, component);
      break;
    case LogLevel.ERROR:
      globalLogger.error(fullMessage, undefined, context, component);
      break;
    case LogLevel.CRITICAL:
      globalLogger.critical(fullMessage, undefined, context, component);
      break;
  }
};

// Convenience functions
export const debug = (message: string, context?: Record<string, any>, component?: string) =>
  globalLogger.debug(message, context, component);

export const info = (message: string, context?: Record<string, any>, component?: string) =>
  globalLogger.info(message, context, component);

export const warn = (message: string, context?: Record<string, any>, component?: string) =>
  globalLogger.warn(message, context, component);

export const error = (
  message: string,
  err?: Error,
  context?: Record<string, any>,
  component?: string
) => globalLogger.error(message, err, context, component);

export const critical = (
  message: string,
  err?: Error,
  context?: Record<string, any>,
  component?: string
) => globalLogger.critical(message, err, context, component);

export const success = (message: string, context?: Record<string, any>, component?: string) =>
  globalLogger.success(message, context, component);

// Convenience functions with icons
export const logSuccess = (message: string, context?: Record<string, any>, component?: string) =>
  globalLogger.success(message, context, component);
