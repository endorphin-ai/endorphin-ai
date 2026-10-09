/**
 * Dependency Injection Container
 * Manages service registration, resolution, and lifecycle
 */

// Simple console logging to avoid circular dependencies
const log = {
  info: (msg: string, data?: any) => console.log(`[DI] ${msg}`, data || ''),
  debug: (msg: string, data?: any) => console.debug(`🐞 [DI] ${msg}`, data || ''),
  warn: (msg: string, data?: any) => console.warn(`[DI] ${msg}`, data || ''),
  error: (msg: string, error?: any) => console.error(`[DI] ${msg}`, error || ''),
};

export type ServiceFactory<T = any> = (...args: any[]) => T | Promise<T>;
export type ServiceConstructor<T = any> = new (...args: any[]) => T;

export enum ServiceLifetime {
  SINGLETON = 'singleton',
  TRANSIENT = 'transient',
  SCOPED = 'scoped',
}

export interface ServiceDescriptor<T = any> {
  name: string;
  factory?: ServiceFactory<T>;
  constructor?: ServiceConstructor<T>;
  instance?: T;
  lifetime: ServiceLifetime;
  dependencies: string[];
  metadata: Record<string, any>;
}

export interface ContainerOptions {
  enableAutoResolution?: boolean;
  enableCircularDependencyDetection?: boolean;
  enableLogging?: boolean;
}

export class DependencyContainer {
  private services = new Map<string, ServiceDescriptor>();
  private singletonInstances = new Map<string, any>();
  private scopedInstances = new Map<string, any>();
  private resolutionStack: string[] = [];
  private options: ContainerOptions;

  constructor(options: ContainerOptions = {}) {
    this.options = {
      enableAutoResolution: true,
      enableCircularDependencyDetection: true,
      enableLogging: false,
      ...options,
    };

    if (this.options.enableLogging) {
      log.info('Dependency container initialized', this.options);
    }
  }

  /**
   * Register a service with factory function
   */
  registerFactory<T>(
    name: string,
    factory: ServiceFactory<T>,
    lifetime: ServiceLifetime = ServiceLifetime.SINGLETON,
    dependencies: string[] = [],
    metadata?: Record<string, any>
  ): void {
    const descriptor: ServiceDescriptor<T> = {
      name,
      factory,
      lifetime,
      dependencies,
      metadata: metadata || {},
      constructor: factory as any, // DI container compatibility
    } as any;

    this.services.set(name, descriptor);

    if (this.options.enableLogging) {
      log.debug(`Registered factory service: ${name}`, {
        lifetime,
        dependencies,
        metadata,
      });
    }
  }

  /**
   * Register a service with constructor
   */
  registerConstructor<T>(
    name: string,
    constructor: ServiceConstructor<T>,
    lifetime: ServiceLifetime = ServiceLifetime.SINGLETON,
    dependencies: string[] = [],
    metadata?: Record<string, any>
  ): void {
    const descriptor: ServiceDescriptor<T> = {
      name,
      constructor,
      lifetime,
      dependencies,
      metadata: metadata || {},
    };

    this.services.set(name, descriptor);

    if (this.options.enableLogging) {
      log.debug(`Registered constructor service: ${name}`, {
        lifetime,
        dependencies,
        metadata,
      });
    }
  }

  /**
   * Register a singleton instance
   */
  registerInstance<T>(name: string, instance: T, metadata?: Record<string, any>): void {
    const descriptor: ServiceDescriptor<T> = {
      name,
      instance,
      lifetime: ServiceLifetime.SINGLETON,
      dependencies: [],
      metadata: metadata || {},
      constructor: (() => instance) as any, // DI container compatibility
    } as any;

    this.services.set(name, descriptor);
    this.singletonInstances.set(name, instance);

    if (this.options.enableLogging) {
      log.debug(`Registered instance service: ${name}`, { metadata });
    }
  }

  /**
   * Resolve a service by name
   */
  async resolve<T>(name: string): Promise<T> {
    if (this.options.enableLogging) {
      log.debug(`Resolving service: ${name}`);
    }

    try {
      // Check for circular dependencies
      if (this.options.enableCircularDependencyDetection && this.resolutionStack.includes(name)) {
        throw new Error(
          `Circular dependency detected: ${this.resolutionStack.join(' -> ')} -> ${name}`
        );
      }

      this.resolutionStack.push(name);

      const service = await this.resolveInternal<T>(name);

      this.resolutionStack.pop();

      if (this.options.enableLogging) {
        log.debug(`Successfully resolved service: ${name}`);
      }

      return service;
    } catch (error: any) {
      this.resolutionStack = []; // Clear stack on error
      log.error(`Failed to resolve service: ${name}`, error);
      throw error;
    }
  }

  /**
   * Try to resolve a service (returns null if not found)
   */
  async tryResolve<T>(name: string): Promise<T | null> {
    try {
      return await this.resolve<T>(name);
    } catch {
      return null;
    }
  }

  /**
   * Check if a service is registered
   */
  isRegistered(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * Get all registered service names
   */
  getRegisteredServices(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Get service descriptor
   */
  getServiceDescriptor(name: string): ServiceDescriptor | undefined {
    return this.services.get(name);
  }

  /**
   * Clear all scoped instances
   */
  clearScope(): void {
    this.scopedInstances.clear();

    if (this.options.enableLogging) {
      log.debug('Cleared scoped instances');
    }
  }

  /**
   * Dispose container and cleanup resources
   */
  async dispose(): Promise<void> {
    log.info('Disposing dependency container');

    // Dispose singleton instances that have dispose method
    for (const [name, instance] of this.singletonInstances) {
      if (instance && typeof instance.dispose === 'function') {
        try {
          await instance.dispose();
          log.debug(`Disposed singleton service: ${name}`);
        } catch (error: any) {
          log.warn(`Failed to dispose service: ${name}`, error);
        }
      }
    }

    // Clear all caches
    this.services.clear();
    this.singletonInstances.clear();
    this.scopedInstances.clear();
    this.resolutionStack = [];

    log.info('Dependency container disposed');
  }

  /**
   * Create a child container (inherits registrations)
   */
  createChildContainer(options?: ContainerOptions): DependencyContainer {
    const child = new DependencyContainer({
      ...this.options,
      ...options,
    });

    // Copy service registrations (but not instances)
    for (const [name, descriptor] of this.services) {
      child.services.set(name, { ...descriptor });
    }

    if (this.options.enableLogging) {
      log.debug(`Created child container with ${this.services.size} inherited services`);
    }

    return child;
  }

  /**
   * Get container statistics
   */
  getStatistics() {
    return {
      totalServices: this.services.size,
      singletonInstances: this.singletonInstances.size,
      scopedInstances: this.scopedInstances.size,
      resolutionStackDepth: this.resolutionStack.length,
      servicesByLifetime: this.getServicesByLifetime(),
    };
  }

  // Private methods

  private async resolveInternal<T>(name: string): Promise<T> {
    const descriptor = this.services.get(name);

    if (!descriptor) {
      if (this.options.enableAutoResolution) {
        throw new Error(
          `Service '${name}' is not registered and auto-resolution is not implemented`
        );
      } else {
        throw new Error(`Service '${name}' is not registered`);
      }
    }

    // Handle existing instance
    if (descriptor.instance !== undefined) {
      return descriptor.instance;
    }

    // Handle singleton lifetime
    if (descriptor.lifetime === ServiceLifetime.SINGLETON) {
      const existing = this.singletonInstances.get(name);
      if (existing !== undefined) {
        return existing;
      }
    }

    // Handle scoped lifetime
    if (descriptor.lifetime === ServiceLifetime.SCOPED) {
      const existing = this.scopedInstances.get(name);
      if (existing !== undefined) {
        return existing;
      }
    }

    // Resolve dependencies
    const dependencies = await this.resolveDependencies(descriptor.dependencies);

    // Create instance
    let instance: T;

    if (descriptor.factory) {
      instance = await descriptor.factory(...dependencies);
    } else if (descriptor.constructor) {
      instance = new descriptor.constructor(...dependencies);
    } else {
      throw new Error(`Service '${name}' has no factory or constructor`);
    }

    // Cache instance based on lifetime
    if (descriptor.lifetime === ServiceLifetime.SINGLETON) {
      this.singletonInstances.set(name, instance);
    } else if (descriptor.lifetime === ServiceLifetime.SCOPED) {
      this.scopedInstances.set(name, instance);
    }

    return instance;
  }

  private async resolveDependencies(dependencies: string[]): Promise<any[]> {
    const resolved: any[] = [];

    for (const dependency of dependencies) {
      const service = await this.resolve(dependency);
      resolved.push(service);
    }

    return resolved;
  }

  private getServicesByLifetime() {
    const stats = {
      [ServiceLifetime.SINGLETON]: 0,
      [ServiceLifetime.TRANSIENT]: 0,
      [ServiceLifetime.SCOPED]: 0,
    };

    for (const descriptor of this.services.values()) {
      stats[descriptor.lifetime]++;
    }

    return stats;
  }
}

// Global container instance
export const globalContainer = new DependencyContainer({
  enableAutoResolution: true,
  enableCircularDependencyDetection: true,
  enableLogging: false,
});

// Decorator for automatic service registration
export function Injectable(
  options: {
    name?: string;
    lifetime?: ServiceLifetime;
    dependencies?: string[];
    metadata?: Record<string, any>;
  } = {}
) {
  return function <T extends new (...args: any[]) => any>(constructor: T) {
    const serviceName = options.name || constructor.name;

    globalContainer.registerConstructor(
      serviceName,
      constructor,
      options.lifetime || ServiceLifetime.SINGLETON,
      options.dependencies || [],
      options.metadata
    );

    return constructor;
  };
}

// Decorator for dependency injection
export function Inject(serviceName: string) {
  return function (target: any, propertyKey: string | symbol | undefined, parameterIndex: number) {
    // This would be used with a metadata reflection library in a full implementation
    // For now, it serves as a marker for future enhancement
    const existingMetadata = (Reflect as any).getMetadata?.('inject:dependencies', target) || [];
    existingMetadata[parameterIndex] = serviceName;
    (Reflect as any).defineMetadata?.('inject:dependencies', existingMetadata, target);
  };
}

// Factory function for creating containers
export function createContainer(options?: ContainerOptions): DependencyContainer {
  return new DependencyContainer(options);
}
