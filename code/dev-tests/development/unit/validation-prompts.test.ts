import { getValidationSystemPrompt, getValidationAnalysisPrompt } from '../../../framework/ai/prompts/validation-prompts';

describe('Validation Prompts', () => {
  test('getValidationSystemPrompt returns string with testTask', () => {
    const testTask = 'Verify login works';
    const prompt = getValidationSystemPrompt(testTask);

    expect(prompt).toContain('You are a test result validator');
    expect(prompt).toContain(`Test Task: ${testTask}`);
    expect(prompt).toContain('Rules:');
  });

  test('getValidationAnalysisPrompt returns string with executionHistory and testTask', () => {
    const history = '1. USER: Login\n2. AGENT: Clicked login';
    const testTask = 'Verify login works';
    const prompt = getValidationAnalysisPrompt(history, testTask);

    expect(prompt).toContain('Analyze this test execution');
    expect(prompt).toContain(history);
    expect(prompt).toContain(`Remember: The test task was: ${testTask}`);
  });
});
