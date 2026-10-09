/**
 * User utilities for multi-user test support
 */

import type { Page } from 'playwright';

// Global reference to the current browser manager
let currentBrowserManager: any = null;

/**
 * Set the current browser manager instance
 * This is called internally by the framework
 */
export function setBrowserManager(browserManager: any): void {
  currentBrowserManager = browserManager;
}

/**
 * Get the current browser manager instance
 * Used internally by the framework
 */
export function getCurrentBrowserManager(): any | null {
  return currentBrowserManager;
}

/**
 * Get page for a specific user
 * This function can be used in test setup and task functions
 */
export function getPage(userId: string): Page {
  if (!currentBrowserManager) {
    throw new Error('Browser manager not initialized. This function can only be used during test execution.');
  }

  if (!currentBrowserManager.isMultiUserMode()) {
    throw new Error('Multi-user mode is not active. Use getPage() only in multi-user tests.');
  }

  return currentBrowserManager.getUserPage(userId);
}

/**
 * Get current user ID (if any)
 */
export function getCurrentUserId(): string | null {
  if (!currentBrowserManager) {
    return null;
  }

  return currentBrowserManager.getCurrentUserId();
}

/**
 * Get all user IDs in current test
 */
export function getUserIds(): string[] {
  if (!currentBrowserManager) {
    return [];
  }

  return currentBrowserManager.getUserIds();
}

/**
 * Check if multi-user mode is active
 */
export function isMultiUserMode(): boolean {
  if (!currentBrowserManager) {
    return false;
  }

  return currentBrowserManager.isMultiUserMode();
}