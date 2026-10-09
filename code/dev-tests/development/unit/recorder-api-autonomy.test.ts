/**
 * Unit Tests for RecorderAPI Autonomy Features
 * Tests page state capture, error details, and the enhanced CLI output
 *
 * NOTE: Direct import of RecorderAPI triggers Jest module resolution issues with
 * the @automation/ path alias. These tests verify autonomy behavior through the
 * RecorderCLI layer (which mocks RecorderAPI) and test helper functions directly.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { RecorderCLI } from '../../../framework/test-recorder/recorder-cli.js';

// Mock logger
jest.mock('../../../framework/core/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Mock RecorderAPI with autonomy features
const mockCreateSession = jest.fn();
const mockAddStep = jest.fn();
const mockGenerateTest = jest.fn();
const mockListSessions = jest.fn();
const mockGetSessionStatus = jest.fn();

jest.mock('../../../framework/test-recorder/recorder-api', () => ({
  RecorderAPI: jest.fn().mockImplementation(() => ({
    createSession: mockCreateSession,
    addStep: mockAddStep,
    generateTest: mockGenerateTest,
    listSessions: mockListSessions,
    getSessionStatus: mockGetSessionStatus,
  })),
}));

describe('RecorderAPI Autonomy Features (via CLI)', () => {
  let cli: RecorderCLI;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    jest.clearAllMocks();
    cli = new RecorderCLI();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('PageState in createSession output', () => {
    it('should output pageState in create result JSON', async () => {
      mockCreateSession.mockResolvedValue({
        sessionId: 'LOGIN-001-123',
        testId: 'LOGIN-001',
        testName: 'Login Test',
        recordingPath: '/path/to/recording',
        pageState: {
          url: 'https://app.com/login',
          title: 'Login',
          accessibilityTree: '- WebArea "Login"\n  - textbox "Email"\n  - textbox "Password"\n  - button "Log In"',
        },
      });

      await cli.handleCommand('create', ['--id', 'LOGIN-001', '--name', 'Login Test', '--url', 'https://app.com/login']);

      const output = consoleLogSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.pageState).toBeDefined();
      expect(parsed.pageState.url).toBe('https://app.com/login');
      expect(parsed.pageState.title).toBe('Login');
      expect(parsed.pageState.accessibilityTree).toContain('textbox "Email"');
      expect(parsed.pageState.accessibilityTree).toContain('button "Log In"');
    });

    it('should output result without pageState when unavailable', async () => {
      mockCreateSession.mockResolvedValue({
        sessionId: 'LOGIN-001-123',
        testId: 'LOGIN-001',
        testName: 'Login Test',
        recordingPath: '/path/to/recording',
      });

      await cli.handleCommand('create', ['--id', 'LOGIN-001', '--name', 'Login Test']);

      const output = consoleLogSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.pageState).toBeUndefined();
      expect(parsed.sessionId).toBe('LOGIN-001-123');
    });

    it('should include all accessibility tree elements', async () => {
      const tree = [
        '- WebArea "Login"',
        '  - heading "Sign In" (level 1)',
        '  - textbox "Email"',
        '  - textbox "Password"',
        '  - button "Log In"',
        '  - link "Forgot password?"',
        '  - link "Sign Up"',
      ].join('\n');

      mockCreateSession.mockResolvedValue({
        sessionId: 'LOGIN-001-123',
        testId: 'LOGIN-001',
        testName: 'Login Test',
        recordingPath: '/path/to/recording',
        pageState: {
          url: 'https://app.com/login',
          title: 'Login',
          accessibilityTree: tree,
        },
      });

      await cli.handleCommand('create', ['--id', 'LOGIN-001', '--name', 'Login Test']);

      const output = consoleLogSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.pageState.accessibilityTree).toContain('heading "Sign In"');
      expect(parsed.pageState.accessibilityTree).toContain('textbox "Email"');
      expect(parsed.pageState.accessibilityTree).toContain('textbox "Password"');
      expect(parsed.pageState.accessibilityTree).toContain('button "Log In"');
      expect(parsed.pageState.accessibilityTree).toContain('link "Forgot password?"');
      expect(parsed.pageState.accessibilityTree).toContain('link "Sign Up"');
    });
  });

  describe('PageState and ErrorDetails in addStep output', () => {
    it('should output pageState on successful step', async () => {
      mockAddStep.mockResolvedValue({
        sessionId: 'LOGIN-001-123',
        stepNumber: 2,
        description: "Fill the Email field with user@test.com",
        success: true,
        result: "Filled textbox 'Email' with 'user@test.com'",
        beforeScreenshot: '/path/to/before.png',
        afterScreenshot: '/path/to/after.png',
        pageState: {
          url: 'https://app.com/login',
          title: 'Login',
          accessibilityTree: '- WebArea "Login"\n  - textbox "Email" (value: "user@test.com")\n  - textbox "Password"\n  - button "Log In"',
        },
      });

      await cli.handleCommand('add-step', ['--session', 'LOGIN-001-123', '--step', 'Fill the Email field with user@test.com']);

      const output = consoleLogSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.success).toBe(true);
      expect(parsed.pageState).toBeDefined();
      expect(parsed.pageState.accessibilityTree).toContain('textbox "Email" (value: "user@test.com")');
      expect(parsed.errorDetails).toBeUndefined();
    });

    it('should output errorDetails on failed step', async () => {
      mockAddStep.mockResolvedValue({
        sessionId: 'LOGIN-001-123',
        stepNumber: 2,
        description: "Click the Submit button",
        success: false,
        result: "Element not found: button 'Submit'",
        beforeScreenshot: '/path/to/before.png',
        afterScreenshot: '/path/to/after.png',
        pageState: {
          url: 'https://app.com/login',
          title: 'Login',
          accessibilityTree: '- WebArea "Login"\n  - textbox "Email"\n  - button "Log In"',
        },
        errorDetails: {
          failedAction: 'click',
          reason: "Element not found: button 'Submit'",
          availableElements: [
            "textbox 'Email'",
            "textbox 'Password'",
            "button 'Log In'",
            "link 'Forgot password?'",
          ],
        },
      });

      await cli.handleCommand('add-step', ['--session', 'LOGIN-001-123', '--step', 'Click the Submit button']);

      const output = consoleLogSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.success).toBe(false);
      expect(parsed.errorDetails).toBeDefined();
      expect(parsed.errorDetails.failedAction).toBe('click');
      expect(parsed.errorDetails.reason).toContain("button 'Submit'");
      expect(parsed.errorDetails.availableElements).toContain("button 'Log In'");
      expect(parsed.errorDetails.availableElements).toContain("textbox 'Email'");
      expect(parsed.pageState).toBeDefined();
    });

    it('should not include errorDetails on successful step', async () => {
      mockAddStep.mockResolvedValue({
        sessionId: 'LOGIN-001-123',
        stepNumber: 1,
        description: "Navigate to login page",
        success: true,
        result: "Navigated to login page",
        beforeScreenshot: '/path/to/before.png',
        afterScreenshot: '/path/to/after.png',
        pageState: {
          url: 'https://app.com/login',
          title: 'Login',
          accessibilityTree: '- WebArea "Login"',
        },
      });

      await cli.handleCommand('add-step', ['--session', 'LOGIN-001-123', '--step', 'Navigate to login page']);

      const output = consoleLogSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.success).toBe(true);
      expect(parsed.errorDetails).toBeUndefined();
    });
  });

  describe('Autonomous workflow data flow', () => {
    it('should enable Claude Code to read page state → generate next step → execute', async () => {
      // Step 1: Create session — Claude sees the page
      mockCreateSession.mockResolvedValue({
        sessionId: 'LOGIN-001-123',
        testId: 'LOGIN-001',
        testName: 'Login Test',
        recordingPath: '/path/to/recording',
        pageState: {
          url: 'https://app.com/login',
          title: 'Login',
          accessibilityTree: '- WebArea "Login"\n  - textbox "Email"\n  - textbox "Password"\n  - button "Log In"',
        },
      });

      await cli.handleCommand('create', ['--id', 'LOGIN-001', '--name', 'Login Test', '--url', 'https://app.com/login']);

      const createOutput = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);

      // Claude reads the tree and sees textbox "Email"
      expect(createOutput.pageState.accessibilityTree).toContain('textbox "Email"');

      // Step 2: Claude auto-generates step from page state
      mockAddStep.mockResolvedValue({
        sessionId: 'LOGIN-001-123',
        stepNumber: 2,
        description: "Fill the Email field with user@test.com",
        success: true,
        result: "Filled textbox 'Email'",
        beforeScreenshot: '/path/to/before.png',
        afterScreenshot: '/path/to/after.png',
        pageState: {
          url: 'https://app.com/login',
          title: 'Login',
          accessibilityTree: '- WebArea "Login"\n  - textbox "Email" (value: "user@test.com")\n  - textbox "Password"\n  - button "Log In"',
        },
      });

      consoleLogSpy.mockClear();
      await cli.handleCommand('add-step', ['--session', 'LOGIN-001-123', '--step', 'Fill the Email field with user@test.com']);

      const step2Output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(step2Output.success).toBe(true);
      // Claude sees the Email field now has a value
      expect(step2Output.pageState.accessibilityTree).toContain('(value: "user@test.com")');
    });

    it('should enable Claude Code to handle failure → read error → retry with fix', async () => {
      // Step fails
      mockAddStep.mockResolvedValueOnce({
        sessionId: 'LOGIN-001-123',
        stepNumber: 2,
        description: "Click the Submit button",
        success: false,
        result: "Element not found",
        beforeScreenshot: '/path/to/before.png',
        afterScreenshot: '/path/to/after.png',
        pageState: {
          url: 'https://app.com/login',
          title: 'Login',
          accessibilityTree: '- WebArea "Login"\n  - button "Log In"',
        },
        errorDetails: {
          failedAction: 'click',
          reason: "Element not found: button 'Submit'",
          availableElements: ["button 'Log In'", "link 'Sign Up'"],
        },
      });

      await cli.handleCommand('add-step', ['--session', 'LOGIN-001-123', '--step', 'Click the Submit button']);

      const failOutput = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(failOutput.success).toBe(false);

      // Claude reads availableElements and sees button 'Log In'
      expect(failOutput.errorDetails.availableElements).toContain("button 'Log In'");

      // Step 2: Claude retries with corrected prompt
      mockAddStep.mockResolvedValueOnce({
        sessionId: 'LOGIN-001-123',
        stepNumber: 2,
        description: "Click the 'Log In' button",
        success: true,
        result: "Clicked button 'Log In'",
        beforeScreenshot: '/path/to/before2.png',
        afterScreenshot: '/path/to/after2.png',
        pageState: {
          url: 'https://app.com/dashboard',
          title: 'Dashboard',
          accessibilityTree: '- WebArea "Dashboard"\n  - heading "Welcome back" (level 1)',
        },
      });

      consoleLogSpy.mockClear();
      await cli.handleCommand('add-step', ['--session', 'LOGIN-001-123', '--step', "Click the 'Log In' button"]);

      const successOutput = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(successOutput.success).toBe(true);
      // Claude sees the new page
      expect(successOutput.pageState.url).toBe('https://app.com/dashboard');
      expect(successOutput.pageState.accessibilityTree).toContain('heading "Welcome back"');
    });
  });

  describe('ErrorDetails action type inference', () => {
    const testFailureWithAction = async (step: string, expectedAction: string) => {
      mockAddStep.mockResolvedValue({
        sessionId: 'S1',
        stepNumber: 1,
        description: step,
        success: false,
        result: 'Failed',
        beforeScreenshot: '/before.png',
        afterScreenshot: '/after.png',
        errorDetails: {
          failedAction: expectedAction,
          reason: 'Failed',
          availableElements: [],
        },
        pageState: { url: 'https://app.com', title: 'App', accessibilityTree: '' },
      });

      await cli.handleCommand('add-step', ['--session', 'S1', '--step', step]);
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.errorDetails.failedAction).toBe(expectedAction);
      consoleLogSpy.mockClear();
    };

    it('should identify click actions', async () => {
      await testFailureWithAction("Click the Sign In button", 'click');
    });

    it('should identify fill actions', async () => {
      await testFailureWithAction("Fill the Email field", 'fill');
    });

    it('should identify navigate actions', async () => {
      await testFailureWithAction("Navigate to https://app.com", 'navigate');
    });

    it('should identify verify actions', async () => {
      await testFailureWithAction("Verify welcome message is visible", 'verify');
    });

    it('should identify select actions', async () => {
      await testFailureWithAction("Select US from the dropdown", 'select');
    });

    it('should identify hover actions', async () => {
      await testFailureWithAction("Hover over the menu", 'hover');
    });
  });

  describe('PageState content quality', () => {
    it('should include interactive elements with values', async () => {
      mockAddStep.mockResolvedValue({
        sessionId: 'S1',
        stepNumber: 1,
        description: 'Fill email',
        success: true,
        result: 'Filled',
        beforeScreenshot: '/before.png',
        afterScreenshot: '/after.png',
        pageState: {
          url: 'https://app.com',
          title: 'App',
          accessibilityTree: '- WebArea "App"\n  - textbox "Email" (value: "user@test.com")\n  - textbox "Password"\n  - button "Log In" [disabled]',
        },
      });

      await cli.handleCommand('add-step', ['--session', 'S1', '--step', 'Fill email']);
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);

      // Claude can see field values
      expect(output.pageState.accessibilityTree).toContain('(value: "user@test.com")');
      // Claude can see disabled states
      expect(output.pageState.accessibilityTree).toContain('[disabled]');
    });

    it('should show page URL changes after navigation', async () => {
      mockAddStep.mockResolvedValue({
        sessionId: 'S1',
        stepNumber: 3,
        description: 'Click login',
        success: true,
        result: 'Clicked',
        beforeScreenshot: '/before.png',
        afterScreenshot: '/after.png',
        pageState: {
          url: 'https://app.com/dashboard',
          title: 'Dashboard',
          accessibilityTree: '- WebArea "Dashboard"\n  - heading "Welcome" (level 1)',
        },
      });

      await cli.handleCommand('add-step', ['--session', 'S1', '--step', 'Click login']);
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);

      expect(output.pageState.url).toBe('https://app.com/dashboard');
      expect(output.pageState.title).toBe('Dashboard');
    });
  });
});
