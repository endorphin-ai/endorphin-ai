/**
 * Tests for TokenTracker with custom pricing configuration
 */

import { TokenTracker } from '../../../framework/core/token-tracker';
import { PricingConfig } from '../../../framework/config/pricing-config';

describe('TokenTracker with Custom Pricing', () => {
  describe('Constructor and Pricing Configuration', () => {
    test('should initialize with default pricing when no custom pricing provided', () => {
      const tracker = new TokenTracker('gpt-4o');
      const pricing = tracker.getPricingConfig();

      expect(pricing).toHaveProperty('gpt-4o');
      expect(pricing['gpt-4o']).toHaveProperty('input');
      expect(pricing['gpt-4o']).toHaveProperty('output');
    });

    test('should initialize with custom pricing when provided', () => {
      const customPricing: PricingConfig = {
        'custom-model': { input: 0.001, output: 0.002 },
        'gpt-4': { input: 0.025, output: 0.05 }
      };

      const tracker = new TokenTracker('custom-model', customPricing);
      const pricing = tracker.getPricingConfig();

      expect(pricing['custom-model']).toEqual({ input: 0.001, output: 0.002 });
      expect(pricing['gpt-4']).toEqual({ input: 0.025, output: 0.05 });
    });

    test('should merge custom pricing with defaults', () => {
      const customPricing: PricingConfig = {
        'custom-model': { input: 0.001, output: 0.002 }
      };

      const tracker = new TokenTracker('gpt-4o', customPricing);
      const pricing = tracker.getPricingConfig();

      // Should have custom model
      expect(pricing['custom-model']).toEqual({ input: 0.001, output: 0.002 });
      // Should still have default models
      expect(pricing).toHaveProperty('gpt-4o');
      expect(pricing).toHaveProperty('gpt-4');
    });
  });

  describe('Pricing Configuration Updates', () => {
    test('should update pricing configuration', () => {
      const tracker = new TokenTracker('gpt-4o');
      
      const newPricing: PricingConfig = {
        'new-model': { input: 0.005, output: 0.015 }
      };

      tracker.updatePricingConfig(newPricing);
      const pricing = tracker.getPricingConfig();

      expect(pricing['new-model']).toEqual({ input: 0.005, output: 0.015 });
    });

    test('should reset to defaults when updating with undefined', () => {
      const customPricing: PricingConfig = {
        'custom-model': { input: 0.001, output: 0.002 }
      };

      const tracker = new TokenTracker('gpt-4o', customPricing);
      tracker.updatePricingConfig(undefined);
      
      const pricing = tracker.getPricingConfig();
      expect(pricing).not.toHaveProperty('custom-model');
      expect(pricing).toHaveProperty('gpt-4o');
    });
  });

  describe('Model Pricing Retrieval', () => {
    test('should get pricing for current model', () => {
      const customPricing: PricingConfig = {
        'test-model': { input: 0.01, output: 0.03 }
      };

      const tracker = new TokenTracker('test-model', customPricing);
      const modelPricing = tracker.getModelPricing();

      expect(modelPricing).toEqual({ input: 0.01, output: 0.03 });
    });

    test('should get pricing for specified model', () => {
      const customPricing: PricingConfig = {
        'model-a': { input: 0.01, output: 0.02 },
        'model-b': { input: 0.03, output: 0.04 }
      };

      const tracker = new TokenTracker('model-a', customPricing);
      const pricingA = tracker.getModelPricing('model-a');
      const pricingB = tracker.getModelPricing('model-b');

      expect(pricingA).toEqual({ input: 0.01, output: 0.02 });
      expect(pricingB).toEqual({ input: 0.03, output: 0.04 });
    });

    test('should fallback to default pricing for unknown model', () => {
      const tracker = new TokenTracker('gpt-4o');
      const unknownPricing = tracker.getModelPricing('unknown-model');

      expect(unknownPricing).toHaveProperty('input');
      expect(unknownPricing).toHaveProperty('output');
      expect(typeof unknownPricing.input).toBe('number');
      expect(typeof unknownPricing.output).toBe('number');
    });
  });

  describe('Cost Calculation with Custom Pricing', () => {
    test('should calculate cost using custom pricing', () => {
      const customPricing: PricingConfig = {
        'test-model': { input: 0.001, output: 0.002 }
      };

      const tracker = new TokenTracker('test-model', customPricing);
      const usage = tracker.recordUsage(1000, 500); // 1000 input, 500 output tokens

      // Expected cost: (1000/1000 * 0.001) + (500/1000 * 0.002) = 0.001 + 0.001 = 0.002
      expect(usage.cost).toBeCloseTo(0.002, 6);
      expect(usage.model).toBe('test-model');
    });

    test('should use different model pricing when specified in recordUsage', () => {
      const customPricing: PricingConfig = {
        'model-a': { input: 0.001, output: 0.002 },
        'model-b': { input: 0.005, output: 0.010 }
      };

      const tracker = new TokenTracker('model-a', customPricing);
      const usageA = tracker.recordUsage(1000, 1000, 'model-a');
      const usageB = tracker.recordUsage(1000, 1000, 'model-b');

      // Model A: (1000/1000 * 0.001) + (1000/1000 * 0.002) = 0.003
      expect(usageA.cost).toBeCloseTo(0.003, 6);
      // Model B: (1000/1000 * 0.005) + (1000/1000 * 0.010) = 0.015
      expect(usageB.cost).toBeCloseTo(0.015, 6);
    });

    test('should handle zero-cost pricing', () => {
      const freePricing: PricingConfig = {
        'free-model': { input: 0, output: 0 }
      };

      const tracker = new TokenTracker('free-model', freePricing);
      const usage = tracker.recordUsage(1000, 1000);

      expect(usage.cost).toBe(0);
    });

    test('should handle very high token counts', () => {
      const customPricing: PricingConfig = {
        'test-model': { input: 0.01, output: 0.02 }
      };

      const tracker = new TokenTracker('test-model', customPricing);
      const usage = tracker.recordUsage(100000, 50000); // Large token counts

      // Expected: (100000/1000 * 0.01) + (50000/1000 * 0.02) = 1.0 + 1.0 = 2.0
      expect(usage.cost).toBeCloseTo(2.0, 6);
    });
  });

  describe('Model Support and Validation', () => {
    test('should list supported models from custom pricing', () => {
      const customPricing: PricingConfig = {
        'model-1': { input: 0.01, output: 0.02 },
        'model-2': { input: 0.03, output: 0.04 },
        'default': { input: 0.005, output: 0.01 }
      };

      const tracker = new TokenTracker('model-1', customPricing);
      const supportedModels = tracker.getSupportedModels();

      expect(supportedModels).toContain('model-1');
      expect(supportedModels).toContain('model-2');
      expect(supportedModels).not.toContain('default'); // 'default' should be filtered out
    });

    test('should check if model is supported', () => {
      const customPricing: PricingConfig = {
        'Supported-Model': { input: 0.01, output: 0.02 }
      };

      const tracker = new TokenTracker('gpt-4o', customPricing);

      expect(tracker.isModelSupported('Supported-Model')).toBe(true);
      expect(tracker.isModelSupported('supported-model')).toBe(true); // Case insensitive
      expect(tracker.isModelSupported('SUPPORTED-MODEL')).toBe(true);
      expect(tracker.isModelSupported('unsupported-model')).toBe(false);
    });

    test('should provide comprehensive pricing info', () => {
      const customPricing: PricingConfig = {
        'current-model': { input: 0.01, output: 0.02 },
        'other-model': { input: 0.03, output: 0.04 }
      };

      const tracker = new TokenTracker('current-model', customPricing);
      const pricingInfo = tracker.getPricingInfo();

      expect(pricingInfo.currentModel).toBe('current-model');
      expect(pricingInfo.supportedModels).toContain('current-model');
      expect(pricingInfo.supportedModels).toContain('other-model');
      expect(pricingInfo.pricing['current-model']).toEqual({ input: 0.01, output: 0.02 });
      expect(pricingInfo.currentModelPricing).toEqual({ input: 0.01, output: 0.02 });
    });
  });

  describe('Session Summary with Custom Pricing', () => {
    test('should include custom pricing in session calculations', () => {
      const customPricing: PricingConfig = {
        'cheap-model': { input: 0.0001, output: 0.0002 }
      };

      const tracker = new TokenTracker('cheap-model', customPricing);
      
      // Record multiple usages
      tracker.recordUsage(1000, 500); // Cost: 0.0001 + 0.0001 = 0.0002
      tracker.recordUsage(2000, 1000); // Cost: 0.0002 + 0.0002 = 0.0004

      const summary = tracker.getSessionSummary();

      expect(summary.totalTokens).toBe(4500); // 1000+500+2000+1000
      expect(summary.totalCost).toBeCloseTo(0.0006, 6); // 0.0002 + 0.0004
      expect(summary.aiCalls).toBe(2);
      expect(summary.model).toBe('cheap-model');
    });

    test('should format costs correctly with custom pricing', () => {
      const customPricing: PricingConfig = {
        'expensive-model': { input: 0.1, output: 0.2 }
      };

      const tracker = new TokenTracker('expensive-model', customPricing);
      tracker.recordUsage(1000, 1000); // Cost: 0.1 + 0.2 = 0.3

      const formattedCost = tracker.getFormattedCost();
      expect(formattedCost).toBe('$0.3000');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid custom pricing gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const invalidPricing = {
        'bad-model': { input: 'invalid', output: 0.02 }
      };

      // Should fallback to defaults
      const tracker = new TokenTracker('gpt-4o', invalidPricing as any);
      const pricing = tracker.getPricingConfig();

      expect(pricing).toHaveProperty('gpt-4o');
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('should warn when using unknown model pricing', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const tracker = new TokenTracker('gpt-4o');
      tracker.recordUsage(1000, 1000, 'completely-unknown-model');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No pricing found for model: completely-unknown-model')
      );

      consoleSpy.mockRestore();
    });

    test('should handle model name case sensitivity', () => {
      const customPricing: PricingConfig = {
        'Model-Name': { input: 0.01, output: 0.02 }
      };

      const tracker = new TokenTracker('model-name', customPricing);
      const usage = tracker.recordUsage(1000, 1000);

      // Should find the model despite case difference
      expect(usage.cost).toBeCloseTo(0.03, 6);
    });
  });

  describe('Integration with Framework Config', () => {
    test('should work with undefined pricing config', () => {
      const tracker = new TokenTracker('gpt-4o', undefined);
      const pricing = tracker.getPricingConfig();

      expect(pricing).toHaveProperty('gpt-4o');
      expect(pricing).toHaveProperty('default');
    });

    test('should preserve original pricing config when accessed', () => {
      const originalPricing: PricingConfig = {
        'test-model': { input: 0.01, output: 0.02 }
      };

      const tracker = new TokenTracker('test-model', originalPricing);
      const retrievedPricing = tracker.getPricingConfig();

      // Modifying retrieved pricing shouldn't affect internal state
      retrievedPricing['new-model'] = { input: 0.05, output: 0.10 };
      
      const freshPricing = tracker.getPricingConfig();
      expect(freshPricing).not.toHaveProperty('new-model');
    });
  });
});