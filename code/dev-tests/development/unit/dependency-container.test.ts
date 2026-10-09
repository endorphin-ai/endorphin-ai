/**
 * Tests for Dependency Injection Container
 */

import { DependencyContainer, ServiceLifetime, createContainer } from '../../../framework/core/dependency-container';

describe('DependencyContainer', () => {
  let container: DependencyContainer;

  beforeEach(() => {
    container = createContainer({
      enableLogging: false,
      enableCircularDependencyDetection: true,
    });
  });

  afterEach(async () => {
    await container.dispose();
  });

  describe('Service Registration', () => {
    test('should register factory service', () => {
      container.registerFactory(
        'TestService',
        () => ({ value: 42 }),
        ServiceLifetime.SINGLETON
      );

      expect(container.isRegistered('TestService')).toBe(true);
      expect(container.getRegisteredServices()).toContain('TestService');
    });

    test('should register constructor service', () => {
      class TestClass {
        value = 42;
      }

      container.registerConstructor(
        'TestClass',
        TestClass,
        ServiceLifetime.SINGLETON
      );

      expect(container.isRegistered('TestClass')).toBe(true);
    });

    test('should register instance service', () => {
      const instance = { value: 42 };
      
      container.registerInstance('TestInstance', instance);

      expect(container.isRegistered('TestInstance')).toBe(true);
    });
  });

  describe('Service Resolution', () => {
    test('should resolve factory service', async () => {
      container.registerFactory(
        'TestService',
        () => ({ value: 42 }),
        ServiceLifetime.SINGLETON
      );

      const service = await container.resolve('TestService');
      expect(service.value).toBe(42);
    });

    test('should resolve constructor service', async () => {
      class TestClass {
        value = 42;
      }

      container.registerConstructor('TestClass', TestClass);

      const instance = await container.resolve<TestClass>('TestClass');
      expect(instance.value).toBe(42);
      expect(instance).toBeInstanceOf(TestClass);
    });

    test('should resolve instance service', async () => {
      const originalInstance = { value: 42 };
      container.registerInstance('TestInstance', originalInstance);

      const resolvedInstance = await container.resolve('TestInstance');
      expect(resolvedInstance).toBe(originalInstance);
    });

    test('should return same instance for singleton services', async () => {
      container.registerFactory(
        'SingletonService',
        () => ({ id: Math.random() }),
        ServiceLifetime.SINGLETON
      );

      const instance1 = await container.resolve('SingletonService');
      const instance2 = await container.resolve('SingletonService');

      expect(instance1).toBe(instance2);
    });

    test('should return different instances for transient services', async () => {
      container.registerFactory(
        'TransientService',
        () => ({ id: Math.random() }),
        ServiceLifetime.TRANSIENT
      );

      const instance1 = await container.resolve('TransientService');
      const instance2 = await container.resolve('TransientService');

      expect(instance1).not.toBe(instance2);
    });

    test('should throw error for unregistered service', async () => {
      await expect(container.resolve('UnknownService'))
        .rejects.toThrow('Service \'UnknownService\' is not registered');
    });
  });

  describe('Dependency Injection', () => {
    test('should resolve service with dependencies', async () => {
      // Register dependency
      container.registerFactory(
        'Database',
        () => ({ query: jest.fn() }),
        ServiceLifetime.SINGLETON
      );

      // Register service with dependency
      container.registerFactory(
        'UserService',
        (database) => ({ database, getUsers: jest.fn() }),
        ServiceLifetime.SINGLETON,
        ['Database']
      );

      const userService = await container.resolve('UserService');
      expect(userService.database).toBeDefined();
      expect(userService.database.query).toBeDefined();
    });

    test('should resolve complex dependency chain', async () => {
      // Level 1
      container.registerFactory('Logger', () => ({ log: jest.fn() }));
      
      // Level 2
      container.registerFactory(
        'Database', 
        (logger) => ({ logger, query: jest.fn() }),
        ServiceLifetime.SINGLETON,
        ['Logger']
      );
      
      // Level 3
      container.registerFactory(
        'UserService',
        (database, logger) => ({ database, logger, getUsers: jest.fn() }),
        ServiceLifetime.SINGLETON,
        ['Database', 'Logger']
      );

      const userService = await container.resolve('UserService');
      expect(userService.database).toBeDefined();
      expect(userService.logger).toBeDefined();
      expect(userService.database.logger).toBeDefined();
    });

    test('should detect circular dependencies', async () => {
      container.registerFactory(
        'ServiceA',
        (serviceB) => ({ serviceB }),
        ServiceLifetime.SINGLETON,
        ['ServiceB']
      );

      container.registerFactory(
        'ServiceB',
        (serviceA) => ({ serviceA }),
        ServiceLifetime.SINGLETON,
        ['ServiceA']
      );

      await expect(container.resolve('ServiceA'))
        .rejects.toThrow(/Circular dependency detected/);
    });
  });

  describe('Scoped Services', () => {
    test('should return same instance within scope', async () => {
      container.registerFactory(
        'ScopedService',
        () => ({ id: Math.random() }),
        ServiceLifetime.SCOPED
      );

      const instance1 = await container.resolve('ScopedService');
      const instance2 = await container.resolve('ScopedService');

      expect(instance1).toBe(instance2);
    });

    test('should return different instances after clearing scope', async () => {
      container.registerFactory(
        'ScopedService',
        () => ({ id: Math.random() }),
        ServiceLifetime.SCOPED
      );

      const instance1 = await container.resolve('ScopedService');
      container.clearScope();
      const instance2 = await container.resolve('ScopedService');

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Service Metadata', () => {
    test('should store and retrieve service metadata', () => {
      const metadata = { description: 'Test service', version: '1.0' };
      
      container.registerFactory(
        'TestService',
        () => ({}),
        ServiceLifetime.SINGLETON,
        [],
        metadata
      );

      const descriptor = container.getServiceDescriptor('TestService');
      expect(descriptor?.metadata).toEqual(metadata);
    });
  });

  describe('Container Statistics', () => {
    test('should provide container statistics', async () => {
      container.registerFactory('Service1', () => ({}), ServiceLifetime.SINGLETON);
      container.registerFactory('Service2', () => ({}), ServiceLifetime.TRANSIENT);
      container.registerFactory('Service3', () => ({}), ServiceLifetime.SCOPED);

      // Resolve one singleton to create instance
      await container.resolve('Service1');

      const stats = container.getStatistics();
      expect(stats.totalServices).toBe(3);
      expect(stats.singletonInstances).toBe(1);
      expect(stats.servicesByLifetime.singleton).toBe(1);
      expect(stats.servicesByLifetime.transient).toBe(1);
      expect(stats.servicesByLifetime.scoped).toBe(1);
    });
  });

  describe('Child Containers', () => {
    test('should create child container with inherited registrations', () => {
      container.registerFactory('ParentService', () => ({ type: 'parent' }));
      
      const child = container.createChildContainer();
      expect(child.isRegistered('ParentService')).toBe(true);
      expect(child.getRegisteredServices()).toContain('ParentService');
    });

    test('should allow child-specific registrations', async () => {
      container.registerFactory('ParentService', () => ({ type: 'parent' }));
      
      const child = container.createChildContainer();
      child.registerFactory('ChildService', () => ({ type: 'child' }));

      expect(child.isRegistered('ChildService')).toBe(true);
      expect(container.isRegistered('ChildService')).toBe(false);

      const childService = await child.resolve('ChildService');
      expect(childService.type).toBe('child');
    });
  });

  describe('Error Handling', () => {
    test('should handle factory errors gracefully', async () => {
      container.registerFactory(
        'FailingService',
        () => {
          throw new Error('Factory failed');
        }
      );

      await expect(container.resolve('FailingService'))
        .rejects.toThrow('Factory failed');
    });

    test('should handle constructor errors gracefully', async () => {
      class FailingClass {
        constructor() {
          throw new Error('Constructor failed');
        }
      }

      container.registerConstructor('FailingClass', FailingClass);

      await expect(container.resolve('FailingClass'))
        .rejects.toThrow('Constructor failed');
    });
  });

  describe('Disposal', () => {
    test('should dispose services with dispose method', async () => {
      const disposeMock = jest.fn();
      const serviceWithDispose = {
        value: 42,
        dispose: disposeMock
      };

      container.registerInstance('DisposableService', serviceWithDispose);
      await container.resolve('DisposableService'); // Ensure it's in singleton cache

      await container.dispose();

      expect(disposeMock).toHaveBeenCalled();
    });

    test('should clear all registrations after disposal', async () => {
      container.registerFactory('TestService', () => ({}));
      
      await container.dispose();

      expect(container.getRegisteredServices()).toHaveLength(0);
    });
  });
});