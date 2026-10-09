/**
 * Resource Management System
 * Handles lifecycle of resources including EventTargets, AbortControllers, and other cleanup
 */

import { EventEmitter } from 'node:events';
import { LIMITS, PERFORMANCE } from '../config/constants.js';
import { ResourceError, ResourceExhaustedError } from '../types/errors.js';
import { ciPerformanceMonitor } from './ci-performance.js';
import { info } from './logger.js';

export interface ManagedResource {
  id: string;
  type: string;
  created: number;
  dispose(): Promise<void> | void;
}

export interface ResourceStats {
  totalResources: number;
  resourcesByType: Record<string, number>;
  oldestResource: number;
  memoryUsage?: NodeJS.MemoryUsage;
}

export class ResourceManager extends EventEmitter {
  private resources: Map<string, ManagedResource> = new Map();
  private disposed = false;
  private cleanupInterval: NodeJS.Timeout | undefined = undefined;
  private abortControllers: Map<string, AbortController> = new Map();

  constructor(
    private maxResources: number = LIMITS.MAX_CONCURRENT_TESTS * 10,
    private cleanupIntervalMs: number = 60000 // 1 minute
  ) {
    super();
    this.setMaxListeners(this.maxResources * 2); // Allow for multiple listeners per resource
    this.startCleanupTimer();
  }

  /**
   * Create and register an AbortController with automatic cleanup
   */
  createAbortController(id?: string): AbortController {
    const controllerId = id || `abort-${Date.now()}-${Math.random()}`;

    // Clean up any existing controller with same ID
    this.disposeAbortController(controllerId);

    const controller = new AbortController();
    this.abortControllers.set(controllerId, controller);

    // Auto-cleanup after a reasonable timeout
    const timeout = setTimeout(() => {
      this.disposeAbortController(controllerId);
    }, PERFORMANCE.SLOW_OPERATION_THRESHOLD * 10); // 10 seconds default

    // Clean up timeout when controller is disposed
    const originalAbort = controller.abort.bind(controller);
    controller.abort = () => {
      clearTimeout(timeout);
      originalAbort();
      this.disposeAbortController(controllerId);
    };

    return controller;
  }

  /**
   * Dispose of a specific AbortController
   */
  disposeAbortController(id: string): void {
    const controller = this.abortControllers.get(id);
    if (controller) {
      if (!controller.signal.aborted) {
        controller.abort();
      }
      this.abortControllers.delete(id);
    }
  }

  /**
   * Register a managed resource
   */
  register<T extends ManagedResource>(resource: T): T {
    if (this.disposed) {
      throw new ResourceError('ResourceManager has been disposed');
    }

    if (this.resources.size >= this.maxResources) {
      // Try to clean up old resources first
      this.cleanup();

      if (this.resources.size >= this.maxResources) {
        throw new ResourceExhaustedError(`Maximum resources exceeded: ${this.maxResources}`, {
          currentCount: this.resources.size,
          maxResources: this.maxResources,
        });
      }
    }

    this.resources.set(resource.id, resource);
    this.emit('resourceRegistered', resource);

    return resource;
  }

  /**
   * Dispose of a specific resource
   */
  async dispose(id: string): Promise<void> {
    const resource = this.resources.get(id);
    if (resource) {
      try {
        await resource.dispose();
      } catch (error) {
        this.emit('disposeError', error, resource);
      } finally {
        this.resources.delete(id);
        this.emit('resourceDisposed', resource);
      }
    }
  }

  /**
   * Get resource by ID
   */
  get<T extends ManagedResource>(id: string): T | undefined {
    return this.resources.get(id) as T;
  }

  /**
   * Check if resource exists
   */
  has(id: string): boolean {
    return this.resources.has(id);
  }

  /**
   * Get all resources of a specific type
   */
  getByType<T extends ManagedResource>(type: string): T[] {
    return Array.from(this.resources.values()).filter((resource) => resource.type === type) as T[];
  }

  /**
   * Get resource statistics
   */
  getStats(): ResourceStats {
    const resourcesByType: Record<string, number> = {};
    let oldestResource = Date.now();

    for (const resource of this.resources.values()) {
      resourcesByType[resource.type] = (resourcesByType[resource.type] || 0) + 1;
      oldestResource = Math.min(oldestResource, resource.created);
    }

    return {
      totalResources: this.resources.size,
      resourcesByType,
      oldestResource,
      memoryUsage: process.memoryUsage(),
    };
  }

  /**
   * Force cleanup of old or unused resources
   */
  cleanup(): void {
    const now = Date.now();
    const maxAge = 300000; // 5 minutes
    const toDispose: string[] = [];

    for (const [id, resource] of this.resources) {
      if (now - resource.created > maxAge) {
        toDispose.push(id);
      }
    }

    // Dispose old resources
    for (const id of toDispose) {
      this.dispose(id).catch((error) => {
        this.emit('cleanupError', error, id);
      });
    }

    // Clean up orphaned abort controllers
    for (const [id, controller] of this.abortControllers) {
      if (controller.signal.aborted) {
        this.abortControllers.delete(id);
      }
    }

    this.emit('cleanup', toDispose.length);
    
    // Record cleanup activity for CI performance monitoring
    if (toDispose.length > 0) {
      ciPerformanceMonitor.recordCleanup();
    }
  }

  /**
   * Dispose all resources and cleanup
   */
  async disposeAll(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    // Stop cleanup timer
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    // Dispose all abort controllers
    for (const [id] of this.abortControllers) {
      this.disposeAbortController(id);
    }

    // Dispose all resources
    const disposePromises = Array.from(this.resources.keys()).map((id) => this.dispose(id));

    try {
      await Promise.allSettled(disposePromises);
    } catch (error) {
      this.emit('disposeAllError', error);
    }

    this.resources.clear();
    this.abortControllers.clear();
    this.removeAllListeners();
    this.emit('disposed');
  }

  /**
   * Check memory usage and warn if threshold exceeded
   */
  checkMemoryUsage(): void {
    const memoryUsage = process.memoryUsage();

    if (memoryUsage.heapUsed > PERFORMANCE.MEMORY_WARNING_THRESHOLD) {
      const stats = this.getStats();
      this.emit('memoryWarning', {
        memoryUsage,
        resourceStats: stats,
        message: `High memory usage detected: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      });

      // Force cleanup on high memory usage
      this.cleanup();

      // CI-specific aggressive memory management (opt-in)
      if (process.env.CI && process.env.ENDORPHIN_AGGRESSIVE_GC === 'true') {
        this.performAggressiveCleanup();
      }
    }
  }

  /**
   * Perform aggressive cleanup in CI environments
   */
  private performAggressiveCleanup(): void {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      info('Forced garbage collection in CI', {}, 'ResourceManager');
      ciPerformanceMonitor.recordGC();
    }

    // Clear all old resources more aggressively
    const now = Date.now();
    const aggressiveMaxAge = 60000; // 1 minute in CI vs 5 minutes normally
    const toDispose: string[] = [];

    for (const [id, resource] of this.resources) {
      if (now - resource.created > aggressiveMaxAge) {
        toDispose.push(id);
      }
    }

    // Dispose old resources immediately
    for (const id of toDispose) {
      this.dispose(id).catch((error) => {
        this.emit('cleanupError', error, id);
      });
    }

    if (toDispose.length > 0) {
      info(`Aggressively cleaned up ${toDispose.length} resources in CI`, { resourceCount: toDispose.length }, 'ResourceManager');
    }
  }

  private startCleanupTimer(): void {
    // More frequent cleanup in CI environments
    const intervalMs = process.env.CI ? Math.min(this.cleanupIntervalMs, 30000) : this.cleanupIntervalMs;
    
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
      this.checkMemoryUsage();
    }, intervalMs);

    if (process.env.CI) {
      info(`CI mode: Resource cleanup interval set to ${intervalMs / 1000}s`, { intervalMs }, 'ResourceManager');
    }
  }
}

// Managed resource implementations
export class ManagedAbortController implements ManagedResource {
  public readonly id: string;
  public readonly type = 'abort-controller';
  public readonly created: number;
  private controller: AbortController;

  constructor(id?: string) {
    this.id = id || `abort-${Date.now()}-${Math.random()}`;
    this.created = Date.now();
    this.controller = new AbortController();
  }

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  abort(): void {
    this.controller.abort();
  }

  dispose(): void {
    if (!this.controller.signal.aborted) {
      this.controller.abort();
    }
  }
}

export class ManagedEventTarget implements ManagedResource {
  public readonly id: string;
  public readonly type = 'event-target';
  public readonly created: number;
  private eventTarget: EventTarget;
  private listeners: Map<string, Array<{ listener: EventListener; options?: any }>> = new Map();

  constructor(id?: string, eventTarget?: EventTarget) {
    this.id = id || `event-target-${Date.now()}-${Math.random()}`;
    this.created = Date.now();
    this.eventTarget = eventTarget || new EventTarget();
  }

  addEventListener(type: string, listener: EventListener, options?: any): void {
    this.eventTarget.addEventListener(type, listener, options);

    // Track listeners for cleanup
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push({ listener, options });
  }

  removeEventListener(type: string, listener: EventListener, options?: any): void {
    this.eventTarget.removeEventListener(type, listener, options);

    // Remove from tracking
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      const index = typeListeners.findIndex((l) => l.listener === listener);
      if (index !== -1) {
        typeListeners.splice(index, 1);
      }
    }
  }

  dispatchEvent(event: Event): boolean {
    return this.eventTarget.dispatchEvent(event);
  }

  dispose(): void {
    // Remove all tracked listeners
    for (const [type, typeListeners] of this.listeners) {
      for (const { listener, options } of typeListeners) {
        this.eventTarget.removeEventListener(type, listener, options);
      }
    }
    this.listeners.clear();
  }
}

// Global resource manager instance
export const globalResourceManager = new ResourceManager();

// Cleanup on process exit
process.on('exit', () => {
  globalResourceManager.disposeAll();
});

process.on('SIGINT', async () => {
  await globalResourceManager.disposeAll();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await globalResourceManager.disposeAll();
  process.exit(0);
});
