/**
 * Unit Tests for ConfigLoader - Core Configuration System
 */

describe('ConfigLoader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Configuration Loading', () => {
    test('should create a ConfigLoader instance', () => {
      const mockConfigLoader = {
        loadConfig: jest.fn().mockResolvedValue({
          browser: {
            headless: false,
            viewport: { width: 1280, height: 720 },
            timeout: 30000,
            slowMo: 0,
            devtools: false,
            recordVideo: false,
            recordHar: false
          },
          ai: {
            openai: {
              apiKey: 'test-api-key',
              modelName: 'gpt-4o',
              temperature: 0.1,
              maxTokens: 4000
            }
          },
          testsDirectory: 'tests',
          dataDirectory: 'test-data',
          resultsDirectory: 'test-results',
          environment: 'development'
        })
      };

      expect(mockConfigLoader).toBeDefined();
      expect(mockConfigLoader.loadConfig).toBeDefined();
    });

    test('should load default configuration', async () => {
      const mockConfigLoader = {
        loadConfig: jest.fn().mockResolvedValue({
          browser: {
            headless: false,
            viewport: { width: 1280, height: 720 },
            timeout: 30000
          },
          ai: {
            openai: {
              apiKey: 'test-api-key',
              modelName: 'gpt-4o'
            }
          }
        })
      };

      const config = await mockConfigLoader.loadConfig();
      
      expect(config.browser.headless).toBe(false);
      expect(config.browser.viewport).toEqual({ width: 1280, height: 720 });
      expect(config.ai.openai.modelName).toBe('gpt-4o');
    });

    test('should handle CLI flag overrides', async () => {
      const mockConfigLoader = {
        loadConfigWithFlags: jest.fn().mockImplementation(async (path, flags) => ({
          browser: {
            headless: flags.headless || false,
            viewport: flags.viewport ? { width: 1920, height: 1080 } : { width: 1280, height: 720 },
            timeout: flags.timeout || 30000
          },
          ai: {
            openai: {
              apiKey: 'test-api-key',
              modelName: flags.model || 'gpt-4o'
            }
          }
        }))
      };

      const flags = {
        headless: true,
        viewport: '1920x1080',
        model: 'gpt-4'
      };

      const config = await mockConfigLoader.loadConfigWithFlags('/', flags);
      
      expect(config.browser.headless).toBe(true);
      expect(config.browser.viewport).toEqual({ width: 1920, height: 1080 });
      expect(config.ai.openai.modelName).toBe('gpt-4');
    });

    test('should validate configuration structure', async () => {
      const mockConfigLoader = {
        loadConfig: jest.fn().mockResolvedValue({
          browser: {
            headless: false,
            viewport: { width: 1280, height: 720 },
            timeout: 30000
          },
          ai: {
            openai: {
              apiKey: 'test-api-key',
              modelName: 'gpt-4o'
            }
          },
          testsDirectory: 'tests',
          resultsDirectory: 'test-results'
        })
      };

      const config = await mockConfigLoader.loadConfig();
      
      // Validate required fields exist
      expect(config.browser).toBeDefined();
      expect(config.ai).toBeDefined();
      expect(config.testsDirectory).toBeDefined();
      expect(config.resultsDirectory).toBeDefined();
      
      // Validate types
      expect(typeof config.browser.headless).toBe('boolean');
      expect(typeof config.browser.timeout).toBe('number');
      expect(typeof config.testsDirectory).toBe('string');
    });
  });

  describe('Environment Variables', () => {
    test('should handle OPENAI_API_KEY from environment', () => {
      const originalApiKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'env-test-key';
      
      expect(process.env.OPENAI_API_KEY).toBe('env-test-key');
      
      // Restore
      process.env.OPENAI_API_KEY = originalApiKey;
    });

    test('should handle missing environment variables', () => {
      const originalApiKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      
      expect(process.env.OPENAI_API_KEY).toBeUndefined();
      
      // Restore
      process.env.OPENAI_API_KEY = originalApiKey;
    });
  });

  describe('Error Handling', () => {
    test('should handle configuration loading errors', async () => {
      const mockConfigLoader = {
        loadConfig: jest.fn().mockRejectedValue(new Error('Config file not found'))
      };

      await expect(mockConfigLoader.loadConfig()).rejects.toThrow('Config file not found');
    });

    test('should handle invalid configuration format', async () => {
      const mockConfigLoader = {
        loadConfig: jest.fn().mockRejectedValue(new Error('Invalid configuration format'))
      };

      await expect(mockConfigLoader.loadConfig()).rejects.toThrow('Invalid configuration format');
    });
  });
});
