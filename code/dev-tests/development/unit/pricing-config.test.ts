/**
 * Tests for Token Pricing Configuration
 */

import {
  PricingConfig,
  ModelPricing,
  DEFAULT_MODEL_PRICING,
  validatePricingConfig,
  mergePricingConfig,
  getModelPricing
} from '../../../framework/config/pricing-config';

describe('PricingConfig', () => {
  describe('validatePricingConfig', () => {
    test('should validate a correct pricing configuration', () => {
      const validPricing: PricingConfig = {
        'gpt-4': { input: 0.03, output: 0.06 },
        'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 }
      };

      const result = validatePricingConfig(validPricing);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    test('should reject non-object pricing config', () => {
      const result = validatePricingConfig('invalid');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Pricing configuration must be an object');
    });

    test('should reject null or undefined pricing config', () => {
      const nullResult = validatePricingConfig(null);
      const undefinedResult = validatePricingConfig(undefined);

      expect(nullResult.isValid).toBe(false);
      expect(undefinedResult.isValid).toBe(false);
    });

    test('should reject empty model names', () => {
      const invalidPricing = {
        '': { input: 0.01, output: 0.02 }
      };

      const result = validatePricingConfig(invalidPricing);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Model names must be non-empty strings');
    });

    test('should reject non-object model pricing', () => {
      const invalidPricing = {
        'gpt-4': 'invalid'
      };

      const result = validatePricingConfig(invalidPricing);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Pricing for model "gpt-4" must be an object');
    });

    test('should reject non-numeric input prices', () => {
      const invalidPricing = {
        'gpt-4': { input: 'invalid', output: 0.06 }
      };

      const result = validatePricingConfig(invalidPricing);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Input price for model "gpt-4" must be a number');
    });

    test('should reject non-numeric output prices', () => {
      const invalidPricing = {
        'gpt-4': { input: 0.03, output: 'invalid' }
      };

      const result = validatePricingConfig(invalidPricing);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Output price for model "gpt-4" must be a number');
    });

    test('should reject negative input prices', () => {
      const invalidPricing = {
        'gpt-4': { input: -0.01, output: 0.06 }
      };

      const result = validatePricingConfig(invalidPricing);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Input price for model "gpt-4" must be non-negative');
    });

    test('should reject negative output prices', () => {
      const invalidPricing = {
        'gpt-4': { input: 0.03, output: -0.01 }
      };

      const result = validatePricingConfig(invalidPricing);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Output price for model "gpt-4" must be non-negative');
    });

    test('should warn about unusually high prices', () => {
      const expensivePricing = {
        'expensive-model': { input: 1.5, output: 2.0 }
      };

      const result = validatePricingConfig(expensivePricing);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Input price for model "expensive-model" seems high ($1.5 per 1K tokens)');
      expect(result.warnings).toContain('Output price for model "expensive-model" seems high ($2 per 1K tokens)');
    });

    test('should warn when output price is lower than input price', () => {
      const unusualPricing = {
        'unusual-model': { input: 0.06, output: 0.03 }
      };

      const result = validatePricingConfig(unusualPricing);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Output price for model "unusual-model" is lower than input price (unusual)');
    });

    test('should handle multiple validation errors', () => {
      const invalidPricing = {
        'model1': { input: -1, output: 'invalid' },
        'model2': { input: 'bad', output: -2 }
      };

      const result = validatePricingConfig(invalidPricing);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('mergePricingConfig', () => {
    test('should return default pricing when no user pricing provided', () => {
      const result = mergePricingConfig();

      expect(result).toEqual(DEFAULT_MODEL_PRICING);
    });

    test('should return default pricing when user pricing is undefined', () => {
      const result = mergePricingConfig(undefined);

      expect(result).toEqual(DEFAULT_MODEL_PRICING);
    });

    test('should merge user pricing with defaults', () => {
      const userPricing: PricingConfig = {
        'custom-model': { input: 0.01, output: 0.02 },
        'gpt-4': { input: 0.025, output: 0.05 } // Override default
      };

      const result = mergePricingConfig(userPricing);

      expect(result['custom-model']).toEqual({ input: 0.01, output: 0.02 });
      expect(result['gpt-4']).toEqual({ input: 0.025, output: 0.05 });
      expect(result['gpt-4o']).toEqual(DEFAULT_MODEL_PRICING['gpt-4o']);
    });

    test('should fallback to defaults when user pricing is invalid', () => {
      // Mock console.warn to avoid output during tests
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const invalidPricing = {
        'model1': { input: 'invalid', output: 0.02 }
      };

      const result = mergePricingConfig(invalidPricing);

      expect(result).toEqual(DEFAULT_MODEL_PRICING);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid user pricing configuration'),
        expect.any(Array)
      );

      consoleSpy.mockRestore();
    });

    test('should log warnings for valid but unusual pricing', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const unusualPricing: PricingConfig = {
        'expensive-model': { input: 1.5, output: 0.5 }
      };

      const result = mergePricingConfig(unusualPricing);

      expect(result['expensive-model']).toEqual({ input: 1.5, output: 0.5 });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Pricing configuration warnings'),
        expect.any(Array)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getModelPricing', () => {
    const testPricing: PricingConfig = {
      'gpt-4': { input: 0.03, output: 0.06 },
      'Custom-Model': { input: 0.01, output: 0.02 },
      'default': { input: 0.005, output: 0.01 }
    };

    test('should return exact match pricing', () => {
      const result = getModelPricing('gpt-4', testPricing);

      expect(result).toEqual({ input: 0.03, output: 0.06 });
    });

    test('should return case-insensitive match pricing', () => {
      const result = getModelPricing('custom-model', testPricing);

      expect(result).toEqual({ input: 0.01, output: 0.02 });
    });

    test('should return case-insensitive match for different case', () => {
      const result = getModelPricing('CUSTOM-MODEL', testPricing);

      expect(result).toEqual({ input: 0.01, output: 0.02 });
    });

    test('should return default pricing when model not found', () => {
      const result = getModelPricing('unknown-model', testPricing);

      expect(result).toEqual({ input: 0.005, output: 0.01 });
    });

    test('should return ultimate fallback when no default exists', () => {
      const pricingWithoutDefault: PricingConfig = {
        'gpt-4': { input: 0.03, output: 0.06 }
      };

      const result = getModelPricing('unknown-model', pricingWithoutDefault);

      expect(result).toEqual(DEFAULT_MODEL_PRICING['gpt-4o']);
    });

    test('should handle empty pricing config', () => {
      const result = getModelPricing('any-model', {});

      expect(result).toEqual(DEFAULT_MODEL_PRICING['gpt-4o']);
    });
  });

  describe('DEFAULT_MODEL_PRICING', () => {
    test('should contain expected models', () => {
      // Get the actual models available in DEFAULT_MODEL_PRICING
      const actualModels = Object.keys(DEFAULT_MODEL_PRICING);
      
      // Check that we have key models that should always be present
      const requiredModels = [
        'gpt-4o',
        'gpt-4',
        'claude-3-opus',
        'claude-3-sonnet',
        'gemini-pro',
        'default'
      ];

      for (const model of requiredModels) {
        expect(DEFAULT_MODEL_PRICING).toHaveProperty(model);
        expect(DEFAULT_MODEL_PRICING[model]).toHaveProperty('input');
        expect(DEFAULT_MODEL_PRICING[model]).toHaveProperty('output');
        expect(typeof DEFAULT_MODEL_PRICING[model].input).toBe('number');
        expect(typeof DEFAULT_MODEL_PRICING[model].output).toBe('number');
        expect(DEFAULT_MODEL_PRICING[model].input).toBeGreaterThanOrEqual(0);
        expect(DEFAULT_MODEL_PRICING[model].output).toBeGreaterThanOrEqual(0);
      }

      // Check that we have a reasonable number of models (at least 10)
      expect(actualModels.length).toBeGreaterThanOrEqual(10);

      // Check all models have valid pricing structure
      for (const model of actualModels) {
        expect(DEFAULT_MODEL_PRICING[model]).toHaveProperty('input');
        expect(DEFAULT_MODEL_PRICING[model]).toHaveProperty('output');
        expect(typeof DEFAULT_MODEL_PRICING[model].input).toBe('number');
        expect(typeof DEFAULT_MODEL_PRICING[model].output).toBe('number');
        expect(DEFAULT_MODEL_PRICING[model].input).toBeGreaterThanOrEqual(0);
        expect(DEFAULT_MODEL_PRICING[model].output).toBeGreaterThanOrEqual(0);
      }
    });

    test('should have reasonable pricing values', () => {
      // All prices should be reasonable (under $1 per 1K tokens)
      for (const [modelName, pricing] of Object.entries(DEFAULT_MODEL_PRICING)) {
        expect(pricing.input).toBeLessThan(1);
        expect(pricing.output).toBeLessThan(1);
        
        // Output pricing is typically higher than input
        if (modelName !== 'default') {
          expect(pricing.output).toBeGreaterThanOrEqual(pricing.input);
        }
      }
    });

    test('should validate against its own validation function', () => {
      const result = validatePricingConfig(DEFAULT_MODEL_PRICING);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Type safety', () => {
    test('ModelPricing interface should enforce correct structure', () => {
      const validPricing: ModelPricing = {
        input: 0.01,
        output: 0.02
      };

      expect(typeof validPricing.input).toBe('number');
      expect(typeof validPricing.output).toBe('number');
    });

    test('PricingConfig interface should enforce correct structure', () => {
      const validConfig: PricingConfig = {
        'model1': { input: 0.01, output: 0.02 },
        'model2': { input: 0.03, output: 0.04 }
      };

      expect(typeof validConfig).toBe('object');
      expect(validConfig['model1']).toHaveProperty('input');
      expect(validConfig['model1']).toHaveProperty('output');
    });
  });

  describe('Edge cases', () => {
    test('should handle zero pricing', () => {
      const zeroPricing = {
        'free-model': { input: 0, output: 0 }
      };

      const result = validatePricingConfig(zeroPricing);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should handle very small pricing', () => {
      const microPricing = {
        'micro-model': { input: 0.00001, output: 0.00002 }
      };

      const result = validatePricingConfig(microPricing);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should handle pricing with many decimal places', () => {
      const precisionPricing = {
        'precise-model': { input: 0.123456789, output: 0.987654321 }
      };

      const result = validatePricingConfig(precisionPricing);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should handle model names with special characters', () => {
      const specialPricing = {
        'model-v1.2_beta': { input: 0.01, output: 0.02 },
        'model@company.com': { input: 0.03, output: 0.04 }
      };

      const result = validatePricingConfig(specialPricing);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});