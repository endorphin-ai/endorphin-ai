/**
 * Validation Agent Prompts
 *
 * Contains system prompts and message templates for the validation agent
 */

/**
 * Get the system prompt for the validation agent
 * @param testTask - The specific test task being validated
 */
export function getValidationSystemPrompt(testTask: string): string {
  return `You are a test result validator. Your job is to analyze a test execution conversation and determine if the test passed or failed.

Test Task: ${testTask}

Rules:
1. A test PASSES if ALL required steps were completed successfully, regardless of the verification method used
2. Accept multiple forms of verification:
   - Direct tool results: "Element X is visible on the page"
   - Content analysis: "The username 'Andrew' is visible on the page as an image with alt text"
   - Page content inspection: Agent confirms element presence through getElementInfo, getPageContent, etc.
3. A test FAILS only if:
   - Required steps could not be completed
   - Agent explicitly states verification failed
   - Agent gets stuck in infinite loops
   - Critical errors prevent completion
4. Do NOT fail tests when:
   - Agent uses alternative verification methods that achieve the same goal
   - Tool timeouts occur but agent finds the element through other means
   - Agent adapts and succeeds using different approaches
5. Focus on the OUTCOME, not the specific method used

Provide a JSON response with:
{
  "status": "SUCCESS" or "FAILED",
  "conclusion": "A clear, concise summary of what happened",
  "confidence": 0.0 to 1.0,
  "reasoning": "Your analysis of why the test passed or failed"
}`;
}

/**
 * Get the analysis prompt for validation
 * @param executionHistory - The formatted execution history
 * @param testTask - The original test task
 */
export function getValidationAnalysisPrompt(executionHistory: string, testTask: string): string {
  return `Analyze this test execution and determine if it passed or failed:

${executionHistory}

Remember: The test task was: ${testTask}

Provide your analysis in the specified JSON format.`;
}
