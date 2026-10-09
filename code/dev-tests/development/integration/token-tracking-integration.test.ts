/**
 * Token Tracking Integration Tests
 * Tests token tracking functionality in isolation from complex dependencies
 */

import { TokenTracker } from '../../../framework/core/token-tracker';

describe('Token Tracking Integration', () => {
  let tokenTracker: TokenTracker;

  beforeEach(() => {
    tokenTracker = new TokenTracker('gpt-4o');
  });

  describe('Real-world Usage Scenarios', () => {
    it('should handle typical test execution flow', () => {
      // Simulate a test with multiple AI interactions
      const testScenarios = [
        { prompt: 'Navigate to the login page', response: 'Successfully navigated to login page' },
        { prompt: 'Fill in the username field with "testuser"', response: 'Username field filled successfully' },
        { prompt: 'Fill in the password field', response: 'Password field filled successfully' },
        { prompt: 'Click the login button', response: 'Login button clicked, user logged in successfully' },
        { prompt: 'Verify user dashboard is displayed', response: 'Dashboard is displayed with user information' },
      ];

      testScenarios.forEach((scenario, _index) => {
        const promptTokens = tokenTracker.estimateTokens(scenario.prompt);
        const responseTokens = tokenTracker.estimateTokens(scenario.response);
        
        const usage = tokenTracker.recordUsage(promptTokens, responseTokens);
        
        expect(usage.promptTokens).toBe(promptTokens);
        expect(usage.responseTokens).toBe(responseTokens);
        expect(usage.totalTokens).toBe(promptTokens + responseTokens);
        expect(usage.cost).toBeGreaterThan(0);
      });

      const summary = tokenTracker.getSessionSummary();
      expect(summary.aiCalls).toBe(5);
      expect(summary.totalTokens).toBeGreaterThan(0);
      expect(summary.totalCost).toBeGreaterThan(0);
      expect(summary.avgTokensPerCall).toBeGreaterThan(0);
    });

    it('should track complex test session with varying content sizes', () => {
      // Simulate different types of AI interactions with varying complexity
      const interactions = [
        { 
          type: 'navigation',
          prompt: 'Go to https://example.com',
          response: 'Page loaded successfully'
        },
        {
          type: 'content_analysis',
          prompt: 'Analyze the current page content and identify all interactive elements including buttons, links, form fields, and any elements that can be clicked or filled. Provide a detailed list with their selectors and current states.',
          response: 'Found 15 interactive elements: 3 buttons (Login, Register, Contact), 2 input fields (email, password), 10 navigation links in header and footer. Login button has selector button[data-testid="login"], email field has placeholder "Enter your email"...'
        },
        {
          type: 'action',
          prompt: 'Click the login button',
          response: 'Clicked successfully'
        },
        {
          type: 'complex_verification',
          prompt: 'Verify that the page has loaded correctly by checking for the presence of expected elements, validating the page title, ensuring no error messages are displayed, and confirming that the navigation menu is properly rendered with all expected links.',
          response: 'Page verification complete: Title is correct ("Dashboard - MyApp"), no error messages found, navigation menu contains all 7 expected links (Home, Profile, Settings, Reports, Help, About, Logout), main content area is visible and properly formatted.'
        }
      ];

      interactions.forEach(interaction => {
        const promptTokens = tokenTracker.estimateTokens(interaction.prompt);
        const responseTokens = tokenTracker.estimateTokens(interaction.response);
        
        tokenTracker.recordUsage(promptTokens, responseTokens);
      });

      const summary = tokenTracker.getSessionSummary();
      expect(summary.aiCalls).toBe(4);
      
      // Complex interactions should result in higher token usage
      expect(summary.avgTokensPerCall).toBeGreaterThan(50);
      expect(summary.totalCost).toBeGreaterThan(0.001); // Should be more than minimal cost
    });

    it('should demonstrate cost differences between models', () => {
      const prompt = 'Perform a comprehensive analysis of the current web page including all interactive elements, their accessibility properties, current states, and provide recommendations for test automation strategies.';
      const response = 'Analysis complete: Found 25 interactive elements with full accessibility metadata. Recommendations include using data-testid attributes for reliable element selection, implementing wait strategies for dynamic content, and creating page object models for maintainable test structure.';
      
      const promptTokens = tokenTracker.estimateTokens(prompt);
      const responseTokens = tokenTracker.estimateTokens(response);
      
      // Test with different models
      const gpt4oUsage = tokenTracker.recordUsage(promptTokens, responseTokens, 'gpt-4o');
      tokenTracker.reset();
      
      const gpt4Usage = tokenTracker.recordUsage(promptTokens, responseTokens, 'gpt-4');
      tokenTracker.reset();
      
      const gpt35Usage = tokenTracker.recordUsage(promptTokens, responseTokens, 'gpt-3.5-turbo');
      
      // Verify cost differences
      expect(gpt4Usage.cost).toBeGreaterThan(gpt4oUsage.cost);
      expect(gpt4oUsage.cost).toBeGreaterThan(gpt35Usage.cost);
      
      // Same token counts
      expect(gpt4oUsage.totalTokens).toBe(gpt4Usage.totalTokens);
      expect(gpt4Usage.totalTokens).toBe(gpt35Usage.totalTokens);
    });
  });

  describe('Session Management Scenarios', () => {
    it('should handle multiple test sessions correctly', () => {
      // First test session
      tokenTracker.recordUsage(100, 50);
      tokenTracker.recordUsage(150, 75);
      
      const session1Summary = tokenTracker.getSessionSummary();
      expect(session1Summary.aiCalls).toBe(2);
      expect(session1Summary.totalTokens).toBe(375);
      
      // Reset for new session
      tokenTracker.reset();
      
      // Second test session
      tokenTracker.recordUsage(200, 100);
      
      const session2Summary = tokenTracker.getSessionSummary();
      expect(session2Summary.aiCalls).toBe(1);
      expect(session2Summary.totalTokens).toBe(300);
      
      // Verify sessions are independent
      expect(session2Summary.totalTokens).not.toBe(session1Summary.totalTokens);
    });

    it('should provide accurate reporting for budget planning', () => {
      // Simulate a day of testing with multiple test sessions
      const dailySessions = [
        [100, 50], [150, 75], [120, 60], // Session 1: Login tests
        [200, 100], [180, 90], [160, 80], // Session 2: Navigation tests  
        [300, 150], [250, 125], [220, 110], // Session 3: Form submission tests
      ];
      
      let totalCost = 0;
      
      dailySessions.forEach(([prompt, response], index) => {
        if (index % 3 === 0) tokenTracker.reset(); // New session every 3 interactions
        
        const usage = tokenTracker.recordUsage(prompt, response);
        totalCost += usage.cost;
      });
      
      expect(totalCost).toBeGreaterThan(0);
      expect(totalCost).toBeLessThan(1); // Should be reasonable for testing
      
      const finalSummary = tokenTracker.getSessionSummary();
      expect(finalSummary.aiCalls).toBe(3); // Last session only
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle rapid successive calls efficiently', () => {
      const startTime = Date.now();
      
      // Simulate rapid AI calls
      for (let i = 0; i < 100; i++) {
        tokenTracker.recordUsage(10 + i, 5 + i);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete quickly (less than 100ms for 100 calls)
      expect(duration).toBeLessThan(100);
      
      const summary = tokenTracker.getSessionSummary();
      expect(summary.aiCalls).toBe(100);
      expect(summary.totalTokens).toBeGreaterThan(1500); // Sum of arithmetic sequence
    });

    it('should maintain precision with very small costs', () => {
      // Test with minimal token usage
      const smallUsage = tokenTracker.recordUsage(1, 1, 'gpt-3.5-turbo');
      expect(smallUsage.cost).toBeGreaterThan(0);
      expect(smallUsage.cost).toBeLessThan(0.0001);
      
      // Test precision is maintained in summary
      const summary = tokenTracker.getSessionSummary();
      expect(summary.totalCost).toBe(smallUsage.cost);
    });

    it('should handle large token counts without overflow', () => {
      const largeUsage = tokenTracker.recordUsage(100000, 50000);
      
      expect(largeUsage.totalTokens).toBe(150000);
      expect(largeUsage.cost).toBeGreaterThan(0.1);
      expect(largeUsage.cost).toBeLessThan(10); // Reasonable upper bound
      
      const summary = tokenTracker.getSessionSummary();
      expect(summary.avgTokensPerCall).toBe(150000);
    });
  });

  describe('Output Formatting for User Display', () => {
    it('should provide user-friendly formatted output', () => {
      tokenTracker.recordUsage(1000, 500, 'gpt-4o');
      tokenTracker.recordUsage(800, 400, 'gpt-4o');
      
      const formattedSummary = tokenTracker.getFormattedSummary();
      
      // Should contain all expected sections
      expect(formattedSummary).toContain('🤖 AI Usage Summary:');
      expect(formattedSummary).toContain('💰 Total Cost:');
      expect(formattedSummary).toContain('🔢 Total Tokens:');
      expect(formattedSummary).toContain('📞 AI Calls:');
      expect(formattedSummary).toContain('📊 Avg Tokens/Call:');
      expect(formattedSummary).toContain('🤖 Model:');
      
      // Check the summary data directly
      const summary = tokenTracker.getSessionSummary();
      expect(summary.totalTokens).toBe(2700); // 1000+500 + 800+400
      expect(summary.aiCalls).toBe(2);
      
      // Should contain actual values (with comma formatting for large numbers)
      expect(formattedSummary).toContain(summary.totalTokens.toLocaleString());
      expect(formattedSummary).toContain('2'); // AI calls
      expect(formattedSummary).toContain('gpt-4o'); // Model
    });

    it('should format costs consistently', () => {
      const usages = [
        tokenTracker.recordUsage(100, 50),
        tokenTracker.recordUsage(200, 100),
        tokenTracker.recordUsage(300, 150),
      ];
      
      usages.forEach(_usage => {
        const formattedCost = tokenTracker.getFormattedCost();
        expect(formattedCost).toMatch(/^\$\d+\.\d{4}$/);
      });
    });
  });
});