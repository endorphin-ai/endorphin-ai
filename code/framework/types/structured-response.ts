/**
 * Structured Response Types
 * Defines schemas for structured AI agent responses
 */

import { z } from 'zod';

/**
 * Step execution status enum
 */
export const StepStatus = z.enum([
  'starting', // Step is beginning
  'in_progress', // Step is currently executing
  'completed', // Step completed successfully
  'failed', // Step failed
]);

export type StepStatusType = z.infer<typeof StepStatus>;

/**
 * Agent action types
 */
export const AgentAction = z.enum([
  'execute_step', // Execute a test step
  'complete_test', // Test is complete
  'error', // Error occurred
]);

export type AgentActionType = z.infer<typeof AgentAction>;

/**
 * Step execution response schema
 */
export const StepExecutionResponse = z.object({
  action: AgentAction,
  stepNumber: z.number().int().positive(),
  totalSteps: z.number().int().positive(),
  stepDescription: z.string(),
  status: StepStatus,
  message: z.string(),
  isComplete: z.boolean(),
  toolCalls: z.array(z.string()).optional(),
  errorDetails: z.string().optional(),
});

export type StepExecutionResponseType = z.infer<typeof StepExecutionResponse>;

/**
 * Test completion response schema
 */
export const TestCompletionResponse = z.object({
  action: z.literal('complete_test'),
  totalSteps: z.number().int().positive(),
  completedSteps: z.number().int().positive(),
  status: z.enum(['success', 'failed']),
  message: z.literal('test completed successfully'),
  summary: z.string(),
  duration: z.number().optional(),
  errors: z.array(z.string()).optional(),
});

export type TestCompletionResponseType = z.infer<typeof TestCompletionResponse>;

/**
 * Union type for all possible structured responses
 */
export const StructuredResponse = z.union([StepExecutionResponse, TestCompletionResponse]);

export type StructuredResponseType = z.infer<typeof StructuredResponse>;

/**
 * Format instructions for the AI agent
 */
export const STRUCTURED_FORMAT_INSTRUCTIONS = `
You must respond with a valid JSON object that matches one of these schemas:

FOR STEP EXECUTION:
{
  "action": "execute_step" | "error",
  "stepNumber": number,
  "totalSteps": number,
  "stepDescription": "description of current step",
  "status": "starting" | "in_progress" | "completed" | "failed",
  "message": "human readable message about step progress",
  "isComplete": boolean (true only if this is the final step),
  "toolCalls": ["tool1", "tool2"] (optional),
  "errorDetails": "error description" (optional)
}

FOR TEST COMPLETION (only after ALL steps are done):
{
  "action": "complete_test",
  "totalSteps": number,
  "completedSteps": number,
  "status": "success" | "failed", 
  "message": "test completed successfully",
  "summary": "brief summary of test execution",
  "duration": number (optional),
  "errors": ["error1", "error2"] (optional)
}

CRITICAL RULES:
1. Always respond with valid JSON
2. Use "complete_test" action ONLY after completing ALL steps
3. Set "isComplete": true ONLY for the final step
4. Include step progress in every response
`;

/**
 * Validate structured response
 * @param response - Response object to validate
 * @returns Validation result
 */
export function validateStructuredResponse(response: unknown): {
  isValid: boolean;
  data?: StructuredResponseType;
  error?: string;
} {
  try {
    const parsed = StructuredResponse.parse(response);
    return { isValid: true, data: parsed };
  } catch (error) {
    const errorMessage =
      error instanceof z.ZodError
        ? error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
        : String(error);
    return { isValid: false, error: errorMessage };
  }
}

/**
 * Create step execution response
 * @param params - Step execution parameters
 * @returns Structured step response
 */
export function createStepResponse(params: {
  stepNumber: number;
  totalSteps: number;
  stepDescription: string;
  status: StepStatusType;
  message: string;
  toolCalls?: string[];
  errorDetails?: string;
}): StepExecutionResponseType {
  return {
    action: 'execute_step',
    stepNumber: params.stepNumber,
    totalSteps: params.totalSteps,
    stepDescription: params.stepDescription,
    status: params.status,
    message: params.message,
    isComplete: params.stepNumber === params.totalSteps && params.status === 'completed',
    toolCalls: params.toolCalls,
    errorDetails: params.errorDetails,
  };
}

/**
 * Create test completion response
 * @param params - Test completion parameters
 * @returns Structured completion response
 */
export function createCompletionResponse(params: {
  totalSteps: number;
  completedSteps: number;
  status: 'success' | 'failed';
  summary: string;
  duration?: number;
  errors?: string[];
}): TestCompletionResponseType {
  return {
    action: 'complete_test',
    totalSteps: params.totalSteps,
    completedSteps: params.completedSteps,
    status: params.status,
    message: 'test completed successfully',
    summary: params.summary,
    duration: params.duration,
    errors: params.errors,
  };
}
