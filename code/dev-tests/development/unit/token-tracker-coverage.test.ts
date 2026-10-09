/**
 * Additional tests for token-tracker.ts to improve coverage
 */

import { TokenTracker } from '../../../framework/core/token-tracker';

describe('TokenTracker - Coverage Enhancement', () => {
  let tracker: TokenTracker;

  beforeEach(() => {
    tracker = new TokenTracker();
  });

  test('should handle edge cases in token estimation', () => {
    // Test with very long text
    const longText = 'word '.repeat(10000);
    const tokens = tracker.estimateTokens(longText);
    expect(tokens).toBeGreaterThan(1000);

    // Test with text containing only special characters
    const specialText = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const specialTokens = tracker.estimateTokens(specialText);
    expect(specialTokens).toBeGreaterThan(0);

    // Test with Unicode characters
    const unicodeText = '🚀 🎯 ✅ 📊 🛠️ 💡 🔧 📝 🧪 🎬';
    const unicodeTokens = tracker.estimateTokens(unicodeText);
    expect(unicodeTokens).toBeGreaterThan(0);

    // Test with newlines and whitespace
    const whitespaceText = '\n\n\t\t   \r\n   \t\t\n\n';
    const whitespaceTokens = tracker.estimateTokens(whitespaceText);
    expect(whitespaceTokens).toBeGreaterThan(0);

    // Test with mixed content
    const mixedText = 'Regular text\n\n🚀 Special chars: !@#$%\n\tTabbed content\n   Spaced content';
    const mixedTokens = tracker.estimateTokens(mixedText);
    expect(mixedTokens).toBeGreaterThan(0);
  });

  test('should handle various model variations and aliases', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Test with different model name variations
    const modelVariations = [
      'gpt-4o',
      'gpt-4',
      'gpt-4-turbo',
      'gpt-3.5-turbo',
      'unknown-model-name',
    ];

    modelVariations.forEach(model => {
      const usage = tracker.recordUsage(100, 50, model);
      expect(usage.cost).toBeGreaterThanOrEqual(0);
      expect(usage.model).toBe(model);
      expect(usage.totalTokens).toBe(150);
    });

    // Should have warned about unknown model
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('No pricing found for model: unknown-model-name')
    );

    const summary = tracker.getSessionSummary();
    expect(summary.totalCost).toBeGreaterThan(0);
    expect(summary.totalTokens).toBeGreaterThan(0);

    consoleSpy.mockRestore();
  });

  test('should handle extreme token counts and precision', () => {
    // Test with very large token counts
    const largeUsage = tracker.recordUsage(1000000, 500000, 'gpt-4o');
    expect(largeUsage.cost).toBeGreaterThan(1); // Should be significant cost

    // Test with very small token counts
    const smallUsage1 = tracker.recordUsage(1, 1, 'gpt-4o');
    const smallUsage2 = tracker.recordUsage(0, 1, 'gpt-4o');
    const smallUsage3 = tracker.recordUsage(1, 0, 'gpt-4o');

    expect(smallUsage1.cost).toBeGreaterThan(0);
    expect(smallUsage1.cost).toBeLessThan(0.01);
    expect(smallUsage2.cost).toBeGreaterThan(0);
    expect(smallUsage3.cost).toBeGreaterThan(0);

    // Test precision with fractional results
    const fractionalUsage = tracker.recordUsage(7, 3, 'gpt-4o'); // Should create fractional cost
    expect(fractionalUsage.cost).toBeGreaterThan(0);
    expect(fractionalUsage.cost.toString()).toMatch(/\d+\.\d+/); // Should have decimal places
  });

  test('should handle session management edge cases', () => {
    // Test with empty session
    let summary = tracker.getSessionSummary();
    expect(summary.totalCost).toBe(0);
    expect(summary.totalTokens).toBe(0);
    expect(summary.aiCalls).toBe(0);
    expect(summary.avgTokensPerCall).toBe(0);

    // Add usage, then reset, then add more
    tracker.recordUsage(100, 50, 'gpt-4o');
    summary = tracker.getSessionSummary();
    expect(summary.totalCost).toBeGreaterThan(0);
    expect(summary.aiCalls).toBe(1);

    tracker.reset();
    summary = tracker.getSessionSummary();
    expect(summary.totalCost).toBe(0);
    expect(summary.totalTokens).toBe(0);
    expect(summary.aiCalls).toBe(0);

    // Add usage after reset
    tracker.recordUsage(200, 100, 'gpt-3.5-turbo');
    summary = tracker.getSessionSummary();
    expect(summary.totalCost).toBeGreaterThan(0);
    expect(summary.totalTokens).toBe(300);
    expect(summary.aiCalls).toBe(1);
  });

  test('should handle cost formatting edge cases', () => {
    // Test very small costs
    tracker.recordUsage(1, 1, 'gpt-3.5-turbo'); // Very small usage
    const formattedSmall = tracker.getFormattedCost();
    expect(formattedSmall).toMatch(/\$0\.00\d+/);

    // Test zero cost (after reset)
    tracker.reset();
    const formattedZero = tracker.getFormattedCost();
    expect(formattedZero).toBe('$0.0000');

    // Test large costs
    tracker.recordUsage(100000, 50000, 'gpt-4o');
    const formattedLarge = tracker.getFormattedCost();
    expect(formattedLarge).toMatch(/\$\d+\.\d{4}/);
  });

  test('should handle summary formatting with various scenarios', () => {
    // Test summary with no usage
    let summary = tracker.getFormattedSummary();
    expect(summary).toContain('No AI calls made yet');

    // Test summary with single request
    tracker.recordUsage(150, 75, 'gpt-4o');
    summary = tracker.getFormattedSummary();
    expect(summary).toContain('AI Usage Summary');
    expect(summary).toContain('Total Cost');
    expect(summary).toContain('225');
    expect(summary).toContain('1'); // AI calls

    // Test summary with multiple requests and different models
    tracker.recordUsage(100, 50, 'gpt-3.5-turbo');
    tracker.recordUsage(200, 100, 'gpt-4');
    summary = tracker.getFormattedSummary();
    expect(summary).toContain('3'); // AI calls
    expect(summary).toContain('675'); // Total tokens (225 + 150 + 300)
    expect(summary).toContain('$');
  });

  test('should handle multiple concurrent tracking scenarios', () => {
    // Simulate concurrent usage tracking
    const usageData = [
      { model: 'gpt-4o', promptTokens: 100, responseTokens: 50 },
      { model: 'gpt-3.5-turbo', promptTokens: 200, responseTokens: 100 },
      { model: 'gpt-4', promptTokens: 150, responseTokens: 75 },
      { model: 'unknown-model', promptTokens: 50, responseTokens: 25 },
    ];

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Record all usage
    usageData.forEach(({ model, promptTokens, responseTokens }) => {
      tracker.recordUsage(promptTokens, responseTokens, model);
    });

    const allUsageRecords = tracker.getAllUsage();
    expect(allUsageRecords.length).toBe(4);

    // Verify each record has required properties
    allUsageRecords.forEach(record => {
      expect(record).toHaveProperty('timestamp');
      expect(record).toHaveProperty('model');
      expect(record).toHaveProperty('promptTokens');
      expect(record).toHaveProperty('responseTokens');
      expect(record).toHaveProperty('totalTokens');
      expect(record).toHaveProperty('cost');
      expect(typeof record.timestamp).toBe('string');
      expect(typeof record.model).toBe('string');
      expect(typeof record.promptTokens).toBe('number');
      expect(typeof record.responseTokens).toBe('number');
      expect(typeof record.totalTokens).toBe('number');
      expect(typeof record.cost).toBe('number');
    });

    const summary = tracker.getSessionSummary();
    expect(summary.aiCalls).toBe(4);
    expect(summary.totalTokens).toBe(750); // Sum of all tokens (150+300+225+75)
    expect(summary.totalCost).toBeGreaterThan(0);

    consoleSpy.mockRestore();
  });

  test('should handle model pricing validation', () => {
    // Test that all supported models have valid pricing
    const supportedModels = ['gpt-4o', 'gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'];

    supportedModels.forEach(model => {
      const usage = tracker.recordUsage(100, 50, model);
      expect(usage.cost).toBeGreaterThan(0);
      
      // Verify cost is reasonable (not too high or too low)
      expect(usage.cost).toBeLessThan(1); // Should be less than $1 for 150 tokens
      expect(usage.cost).toBeGreaterThan(0.0001); // Should be more than $0.0001
    });

    // Test that different models have different costs
    tracker.reset();
    const gpt4oUsage = tracker.recordUsage(100, 50, 'gpt-4o');
    tracker.reset();
    const gpt35Usage = tracker.recordUsage(100, 50, 'gpt-3.5-turbo');
    
    expect(gpt4oUsage.cost).not.toBe(gpt35Usage.cost);
  });

  test('should maintain data integrity across operations', () => {
    // Record initial usage
    tracker.recordUsage(100, 50, 'gpt-4o');
    const initialSummary = tracker.getSessionSummary();
    const initialRecords = tracker.getAllUsage();

    // Verify data consistency
    expect(initialSummary.totalTokens).toBe(150);
    expect(initialSummary.aiCalls).toBe(1);
    expect(initialRecords.length).toBe(1);

    // Add more usage
    tracker.recordUsage(200, 100, 'gpt-3.5-turbo');
    const updatedSummary = tracker.getSessionSummary();
    const updatedRecords = tracker.getAllUsage();

    // Verify cumulative data
    expect(updatedSummary.totalTokens).toBe(450); // 150 + 300
    expect(updatedSummary.aiCalls).toBe(2);
    expect(updatedRecords.length).toBe(2);

    // Verify cost accumulation
    expect(updatedSummary.totalCost).toBeGreaterThan(initialSummary.totalCost);

    // Reset and verify clean state
    tracker.reset();
    const resetSummary = tracker.getSessionSummary();
    const resetRecords = tracker.getAllUsage();

    expect(resetSummary.totalTokens).toBe(0);
    expect(resetSummary.aiCalls).toBe(0);
    expect(resetSummary.totalCost).toBe(0);
    expect(resetRecords.length).toBe(0);
  });

  test('should handle constructor with different models', () => {
    const gpt4Tracker = new TokenTracker('gpt-4');
    const gpt35Tracker = new TokenTracker('gpt-3.5-turbo');
    const defaultTracker = new TokenTracker();

    // Test that default model is set correctly
    const gpt4Summary = gpt4Tracker.getSessionSummary();
    const gpt35Summary = gpt35Tracker.getSessionSummary();
    const defaultSummary = defaultTracker.getSessionSummary();

    expect(gpt4Summary.model).toBe('gpt-4');
    expect(gpt35Summary.model).toBe('gpt-3.5-turbo');
    expect(defaultSummary.model).toBe('gpt-4o'); // Default

    // Test that model is used when not specified in recordUsage
    gpt4Tracker.recordUsage(100, 50);
    const gpt4Usage = gpt4Tracker.getAllUsage()[0];
    expect(gpt4Usage.model).toBe('gpt-4');
  });

  test('should handle edge cases in avgTokensPerCall calculation', () => {
    // Test with single call
    tracker.recordUsage(100, 50);
    let summary = tracker.getSessionSummary();
    expect(summary.avgTokensPerCall).toBe(150);

    // Test with multiple calls
    tracker.recordUsage(200, 100);
    tracker.recordUsage(50, 25);
    summary = tracker.getSessionSummary();
    expect(summary.avgTokensPerCall).toBe(Math.round(525 / 3)); // Should be rounded

    // Test rounding behavior
    tracker.reset();
    tracker.recordUsage(100, 50); // 150 tokens
    tracker.recordUsage(100, 51); // 151 tokens
    summary = tracker.getSessionSummary();
    expect(summary.avgTokensPerCall).toBe(151); // Should round properly
  });
});