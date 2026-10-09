/**
 * Token Tracker Tests
 * Tests for AI token usage tracking and cost calculation
 */

import { TokenTracker } from '../../../framework/core/token-tracker';

describe('TokenTracker', () => {
  let tracker: TokenTracker;

  beforeEach(() => {
    tracker = new TokenTracker('gpt-4o');
  });

  describe('Token Estimation', () => {
    it('should estimate tokens correctly for text', () => {
      const shortText = 'Hello world';
      const longText = 'This is a longer text that should have more tokens estimated based on character count.';
      
      const shortTokens = tracker.estimateTokens(shortText);
      const longTokens = tracker.estimateTokens(longText);
      
      expect(shortTokens).toBeGreaterThan(0);
      expect(longTokens).toBeGreaterThan(shortTokens);
      expect(shortTokens).toBe(Math.ceil(shortText.length / 4));
      expect(longTokens).toBe(Math.ceil(longText.length / 4));
    });

    it('should handle empty text', () => {
      const tokens = tracker.estimateTokens('');
      expect(tokens).toBe(0);
    });

    it('should handle special characters', () => {
      const specialText = '🤖💰📊✅❌🎯';
      const tokens = tracker.estimateTokens(specialText);
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('Token Usage Recording', () => {
    it('should record token usage correctly', () => {
      const usage = tracker.recordUsage(100, 50, 'gpt-4o');
      
      expect(usage.promptTokens).toBe(100);
      expect(usage.responseTokens).toBe(50);
      expect(usage.totalTokens).toBe(150);
      expect(usage.model).toBe('gpt-4o');
      expect(usage.cost).toBeGreaterThan(0);
      expect(usage.timestamp).toBeDefined();
    });

    it('should use default model when not specified', () => {
      const usage = tracker.recordUsage(100, 50);
      expect(usage.model).toBe('gpt-4o');
    });

    it('should handle zero token usage', () => {
      const usage = tracker.recordUsage(0, 0);
      expect(usage.totalTokens).toBe(0);
      expect(usage.cost).toBe(0);
    });
  });

  describe('Cost Calculation', () => {
    it('should calculate GPT-4o costs correctly', () => {
      const usage = tracker.recordUsage(1000, 500, 'gpt-4o');
      // GPT-4o: $0.002187 input, $0.008747 output per 1K tokens (updated July 2025)
      const expectedCost = (1000 / 1000) * 0.002187 + (500 / 1000) * 0.008747;
      expect(usage.cost).toBeCloseTo(expectedCost, 6);
    });

    it('should calculate GPT-4 costs correctly', () => {
      const usage = tracker.recordUsage(1000, 500, 'gpt-4');
      // GPT-4: $0.03 input, $0.06 output per 1K tokens
      const expectedCost = (1000 / 1000) * 0.03 + (500 / 1000) * 0.06;
      expect(usage.cost).toBeCloseTo(expectedCost, 6);
    });

    it('should calculate GPT-3.5-turbo costs correctly', () => {
      const usage = tracker.recordUsage(1000, 500, 'gpt-3.5-turbo');
      // GPT-3.5-turbo: $0.0005 input, $0.0015 output per 1K tokens
      const expectedCost = (1000 / 1000) * 0.0005 + (500 / 1000) * 0.0015;
      expect(usage.cost).toBeCloseTo(expectedCost, 6);
    });

    it('should handle unknown model with fallback to gpt-4o', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const usage = tracker.recordUsage(1000, 500, 'unknown-model');
      
      expect(consoleSpy).toHaveBeenCalledWith('⚠️ No pricing found for model: unknown-model, using default pricing');
      expect(usage.cost).toBeGreaterThan(0);
      
      consoleSpy.mockRestore();
    });
  });

  describe('Session Management', () => {
    it('should provide empty summary for new session', () => {
      const summary = tracker.getSessionSummary();
      
      expect(summary.totalTokens).toBe(0);
      expect(summary.totalCost).toBe(0);
      expect(summary.aiCalls).toBe(0);
      expect(summary.avgTokensPerCall).toBe(0);
      expect(summary.model).toBe('gpt-4o');
    });

    it('should calculate session summary correctly', () => {
      tracker.recordUsage(100, 50);
      tracker.recordUsage(200, 100);
      tracker.recordUsage(150, 75);
      
      const summary = tracker.getSessionSummary();
      
      expect(summary.totalTokens).toBe(675); // (100+50) + (200+100) + (150+75)
      expect(summary.aiCalls).toBe(3);
      expect(summary.avgTokensPerCall).toBe(225); // 675 / 3
      expect(summary.totalCost).toBeGreaterThan(0);
    });

    it('should reset session correctly', () => {
      tracker.recordUsage(100, 50);
      tracker.recordUsage(200, 100);
      
      expect(tracker.getSessionSummary().aiCalls).toBe(2);
      
      tracker.reset();
      
      const summary = tracker.getSessionSummary();
      expect(summary.totalTokens).toBe(0);
      expect(summary.totalCost).toBe(0);
      expect(summary.aiCalls).toBe(0);
    });

    it('should return all usage records', () => {
      tracker.recordUsage(100, 50);
      tracker.recordUsage(200, 100);
      
      const allUsage = tracker.getAllUsage();
      expect(allUsage).toHaveLength(2);
      expect(allUsage[0].promptTokens).toBe(100);
      expect(allUsage[1].promptTokens).toBe(200);
    });
  });

  describe('Formatted Output', () => {
    it('should format cost correctly', () => {
      tracker.recordUsage(1000, 500, 'gpt-4o');
      const formattedCost = tracker.getFormattedCost();
      
      expect(formattedCost).toMatch(/^\$\d+\.\d{4}$/);
      expect(formattedCost).toContain('$');
    });

    it('should format summary for no usage', () => {
      const summary = tracker.getFormattedSummary();
      expect(summary).toBe('🤖 No AI calls made yet');
    });

    it('should format summary with usage', () => {
      tracker.recordUsage(100, 50, 'gpt-4o');
      tracker.recordUsage(200, 100, 'gpt-4o');
      
      const summary = tracker.getFormattedSummary();
      
      expect(summary).toContain('🤖 AI Usage Summary:');
      expect(summary).toContain('💰 Total Cost:');
      expect(summary).toContain('🔢 Total Tokens:');
      expect(summary).toContain('📞 AI Calls:');
      expect(summary).toContain('📊 Avg Tokens/Call:');
      expect(summary).toContain('🤖 Model:');
      expect(summary).toContain('450'); // Total tokens
      expect(summary).toContain('2'); // AI calls
      expect(summary).toContain('gpt-4o'); // Model
    });
  });

  describe('Model Pricing', () => {
    it('should have correct pricing for all supported models', () => {
      const models = ['gpt-4o', 'gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'];
      
      models.forEach(model => {
        const usage = tracker.recordUsage(1000, 1000, model);
        expect(usage.cost).toBeGreaterThan(0);
        expect(usage.model).toBe(model);
      });
    });

    it('should have different costs for different models', () => {
      const gpt4oUsage = tracker.recordUsage(1000, 1000, 'gpt-4o');
      const gpt4Usage = tracker.recordUsage(1000, 1000, 'gpt-4');
      const gpt35Usage = tracker.recordUsage(1000, 1000, 'gpt-3.5-turbo');
      
      expect(gpt4Usage.cost).toBeGreaterThan(gpt4oUsage.cost);
      expect(gpt4oUsage.cost).toBeGreaterThan(gpt35Usage.cost);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large token counts', () => {
      const usage = tracker.recordUsage(100000, 50000);
      expect(usage.totalTokens).toBe(150000);
      expect(usage.cost).toBeGreaterThan(0);
    });

    it('should handle fractional costs correctly', () => {
      const usage = tracker.recordUsage(1, 1, 'gpt-3.5-turbo');
      expect(usage.cost).toBeGreaterThan(0);
      expect(usage.cost).toBeLessThan(0.01);
    });

    it('should maintain precision in cost calculations', () => {
      const usage1 = tracker.recordUsage(1, 1, 'gpt-4o');
      const usage2 = tracker.recordUsage(1, 1, 'gpt-4o');
      
      const summary = tracker.getSessionSummary();
      expect(summary.totalCost).toBeCloseTo(usage1.cost + usage2.cost, 8);
    });
  });
});