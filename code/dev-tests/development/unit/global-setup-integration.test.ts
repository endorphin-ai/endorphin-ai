/**
 * Integration tests for Global Setup functionality
 * Tests the GlobalSetupManager integration with configuration
 */

import { GlobalSetupManager } from '../../../framework/core/global-setup-manager';
import { ConfigManager } from '../../../framework/core/config-manager';
import { resolve, join } from 'path';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';

describe('Global Setup Integration', () => {
  let globalSetupManager: GlobalSetupManager;
  let configManager: ConfigManager;
  let testDir: string;

  beforeEach(() => {
    globalSetupManager = new GlobalSetupManager();
    testDir = resolve(__dirname, '../../../tmp/global-setup-integration');
    
    // Create test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    globalSetupManager.clear();
    
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Configuration integration', () => {
    test('should execute global setup when configured', async () => {
      const setupFile = join(testDir, 'config-integration-setup.ts');
      writeFileSync(setupFile, `
        export default async function globalSetup(): Promise<void> {
          process.env.CONFIG_INTEGRATION_TEST = 'executed';
        }
      `);

      configManager = new ConfigManager({
        globalSetup: setupFile,
        browser: { type: 'chromium', headless: true },
        ai: {
          openai: {
            apiKey: 'test-key',
            modelName: 'gpt-4o',
            temperature: 0.1,
            maxTokens: 8000,
          },
        },
        testsDirectory: 'tests',
        dataDirectory: 'data',
        resultsDirectory: 'results',
        environment: 'development',
      });

      const config = configManager.getConfig();
      expect(config.globalSetup).toBe(setupFile);

      // Execute global setup as the framework would
      if (config.globalSetup) {
        const result = await globalSetupManager.loadAndExecute(config.globalSetup);
        expect(result.success).toBe(true);
        expect(process.env.CONFIG_INTEGRATION_TEST).toBe('executed');
      }
    });

    test('should handle missing global setup gracefully', () => {
      configManager = new ConfigManager({
        // No globalSetup configured
        browser: { type: 'chromium', headless: true },
        ai: {
          openai: {
            apiKey: 'test-key',
            modelName: 'gpt-4o',
            temperature: 0.1,
            maxTokens: 8000,
          },
        },
        testsDirectory: 'tests',
        dataDirectory: 'data',
        resultsDirectory: 'results',
        environment: 'development',
      });

      const config = configManager.getConfig();
      expect(config.globalSetup).toBeUndefined();
    });

    test('should validate global setup file path from config', async () => {
      const setupFile = join(testDir, 'validation-setup.ts');
      writeFileSync(setupFile, `
        export default async function globalSetup(): Promise<void> {
          console.log('Validation test setup');
        }
      `);

      configManager = new ConfigManager({
        globalSetup: setupFile,
        browser: { type: 'chromium', headless: true },
        ai: {
          openai: {
            apiKey: 'test-key',
            modelName: 'gpt-4o',
            temperature: 0.1,
            maxTokens: 8000,
          },
        },
        testsDirectory: 'tests',
        dataDirectory: 'data',
        resultsDirectory: 'results',
        environment: 'development',
      });

      const config = configManager.getConfig();
      const validation = await GlobalSetupManager.validateSetupFile(config.globalSetup!);
      
      expect(validation.valid).toBe(true);
      expect(validation.error).toBeUndefined();
    });
  });

  describe('Real-world setup scenarios', () => {
    test('should handle environment setup with configuration validation', async () => {
      const setupFile = join(testDir, 'env-validation-setup.ts');
      writeFileSync(setupFile, `
        export default async function globalSetup(): Promise<void> {
          // Validate required environment variables
          const requiredVars = ['NODE_ENV'];
          const missing = requiredVars.filter(v => !process.env[v]);
          
          if (missing.length > 0) {
            throw new Error(\`Missing environment variables: \${missing.join(', ')}\`);
          }
          
          // Set up test-specific environment
          process.env.TEST_MODE = 'integration';
          process.env.API_MOCK_ENABLED = 'true';
        }
      `);

      // Ensure NODE_ENV is set
      process.env.NODE_ENV = 'test';

      const result = await globalSetupManager.loadAndExecute(setupFile);
      
      expect(result.success).toBe(true);
      expect(process.env.TEST_MODE).toBe('integration');
      expect(process.env.API_MOCK_ENABLED).toBe('true');
    });

    test('should handle authentication setup', async () => {
      const setupFile = join(testDir, 'auth-setup.ts');
      writeFileSync(setupFile, `
        export default async function globalSetup(): Promise<void> {
          // Simulate authentication token generation
          const mockToken = 'mock-jwt-token-' + Date.now();
          process.env.AUTH_TOKEN = mockToken;
          
          // Simulate user session setup
          global.testUser = {
            id: 'test-user-123',
            email: 'test@example.com',
            token: mockToken
          };
        }
      `);

      const result = await globalSetupManager.loadAndExecute(setupFile);
      
      expect(result.success).toBe(true);
      expect(process.env.AUTH_TOKEN).toContain('mock-jwt-token-');
      expect((global as any).testUser).toEqual({
        id: 'test-user-123',
        email: 'test@example.com',
        token: process.env.AUTH_TOKEN
      });
    });

    test('should handle database/data seeding setup', async () => {
      const setupFile = join(testDir, 'data-seeding-setup.ts');
      writeFileSync(setupFile, `
        export default async function globalSetup(): Promise<void> {
          // Simulate database seeding
          global.seedData = {
            users: [
              { id: 1, name: 'Test User 1', role: 'admin' },
              { id: 2, name: 'Test User 2', role: 'user' }
            ],
            products: [
              { id: 1, name: 'Test Product 1', price: 99.99 },
              { id: 2, name: 'Test Product 2', price: 149.99 }
            ]
          };
          
          // Set database connection string for tests
          process.env.TEST_DB_URL = 'mongodb://localhost:27017/test_db';
        }
      `);

      const result = await globalSetupManager.loadAndExecute(setupFile);
      
      expect(result.success).toBe(true);
      expect((global as any).seedData.users).toHaveLength(2);
      expect((global as any).seedData.products).toHaveLength(2);
      expect(process.env.TEST_DB_URL).toBe('mongodb://localhost:27017/test_db');
    });

    test('should handle external service setup and health checks', async () => {
      const setupFile = join(testDir, 'service-health-setup.ts');
      writeFileSync(setupFile, `
        export default async function globalSetup(): Promise<void> {
          // Simulate external service configuration
          const services = {
            api: 'https://api.test.com',
            payment: 'https://payment.test.com',
            notification: 'https://notify.test.com'
          };
          
          // Store service URLs for tests
          process.env.TEST_API_URL = services.api;
          process.env.TEST_PAYMENT_URL = services.payment;
          process.env.TEST_NOTIFICATION_URL = services.notification;
          
          // Simulate health check results
          global.serviceHealth = {
            api: { status: 'healthy', latency: 45 },
            payment: { status: 'healthy', latency: 67 },
            notification: { status: 'healthy', latency: 23 }
          };
        }
      `);

      const result = await globalSetupManager.loadAndExecute(setupFile);
      
      expect(result.success).toBe(true);
      expect(process.env.TEST_API_URL).toBe('https://api.test.com');
      expect(process.env.TEST_PAYMENT_URL).toBe('https://payment.test.com');
      expect(process.env.TEST_NOTIFICATION_URL).toBe('https://notify.test.com');
      expect((global as any).serviceHealth.api.status).toBe('healthy');
    });

    test('should handle complex multi-step setup with error recovery', async () => {
      const setupFile = join(testDir, 'complex-multi-step-setup.ts');
      writeFileSync(setupFile, `
        export default async function globalSetup(): Promise<void> {
          const setupLog = [];
          
          try {
            // Step 1: Environment validation
            if (!process.env.NODE_ENV) {
              process.env.NODE_ENV = 'test';
            }
            setupLog.push('env-validated');
            
            // Step 2: Service initialization
            await new Promise(resolve => setTimeout(resolve, 5)); // Simulate async setup
            process.env.SERVICE_INITIALIZED = 'true';
            setupLog.push('service-initialized');
            
            // Step 3: Data preparation
            global.testData = {
              timestamp: Date.now(),
              environment: process.env.NODE_ENV,
              services: ['api', 'db', 'cache']
            };
            setupLog.push('data-prepared');
            
            // Step 4: Final validation
            const requiredServices = ['api', 'db', 'cache'];
            const availableServices = global.testData.services;
            const missing = requiredServices.filter(s => !availableServices.includes(s));
            
            if (missing.length > 0) {
              throw new Error(\`Missing services: \${missing.join(', ')}\`);
            }
            setupLog.push('validation-completed');
            
            // Store setup log
            global.setupLog = setupLog;
            process.env.SETUP_COMPLETED_AT = Date.now().toString();
            
          } catch (error) {
            setupLog.push(\`error: \${error.message}\`);
            global.setupLog = setupLog;
            throw error;
          }
        }
      `);

      const result = await globalSetupManager.loadAndExecute(setupFile);
      
      expect(result.success).toBe(true);
      expect((global as any).setupLog).toEqual([
        'env-validated',
        'service-initialized', 
        'data-prepared',
        'validation-completed'
      ]);
      expect((global as any).testData.services).toEqual(['api', 'db', 'cache']);
      expect(process.env.SERVICE_INITIALIZED).toBe('true');
      expect(process.env.SETUP_COMPLETED_AT).toBeDefined();
    });
  });

  describe('Error scenarios and edge cases', () => {
    test('should propagate setup errors with context', async () => {
      const setupFile = join(testDir, 'error-context-setup.ts');
      writeFileSync(setupFile, `
        export default async function globalSetup(): Promise<void> {
          // Simulate a realistic error scenario
          const requiredConfig = process.env.CRITICAL_CONFIG;
          if (!requiredConfig) {
            throw new Error('CRITICAL_CONFIG environment variable is required for test setup');
          }
        }
      `);

      const result = await globalSetupManager.loadAndExecute(setupFile);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toContain('CRITICAL_CONFIG environment variable is required');
    });

    test('should handle timeout scenarios in setup', async () => {
      const setupFile = join(testDir, 'timeout-setup.ts');
      writeFileSync(setupFile, `
        export default async function globalSetup(): Promise<void> {
          // Simulate a setup operation that takes time
          await new Promise(resolve => setTimeout(resolve, 50));
          process.env.TIMEOUT_TEST_COMPLETED = 'true';
        }
      `);

      const startTime = Date.now();
      const result = await globalSetupManager.loadAndExecute(setupFile);
      const duration = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(duration).toBeGreaterThanOrEqual(50);
      expect(result.executionTime).toBeGreaterThanOrEqual(50);
      expect(process.env.TIMEOUT_TEST_COMPLETED).toBe('true');
    });
  });
});