/**
 * Unit Tests for RecorderCLI - CLI command routing and flag parsing
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { RecorderCLI } from '../../../framework/test-recorder/recorder-cli.js';

// Mock logger FIRST (use relative path to avoid moduleNameMapper resolution issues)
jest.mock('../../../framework/core/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Mock RecorderAPI
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

describe('RecorderCLI', () => {
  let cli: RecorderCLI;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    jest.clearAllMocks();
    cli = new RecorderCLI();

    // Spy on console methods to capture output
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('create command', () => {
    it('should parse required flags --id and --name', async () => {
      mockCreateSession.mockResolvedValue({
        sessionId: 'TEST-001-123',
        testId: 'TEST-001',
        testName: 'Login Test',
        recordingPath: '/path/to/recording',
      });

      await cli.handleCommand('create', ['--id', 'TEST-001', '--name', 'Login Test']);

      expect(mockCreateSession).toHaveBeenCalledWith({
        testId: 'TEST-001',
        testName: 'Login Test',
      });

      // Verify user feedback to stderr
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Creating recording session'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Session created successfully'));

      // Verify JSON output to stdout
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('TEST-001-123'));
    });

    it('should parse optional --description flag', async () => {
      mockCreateSession.mockResolvedValue({
        sessionId: 'TEST-001-123',
        testId: 'TEST-001',
        testName: 'Login Test',
        recordingPath: '/path/to/recording',
      });

      await cli.handleCommand('create', [
        '--id',
        'TEST-001',
        '--name',
        'Login Test',
        '--description',
        'Test user login flow',
      ]);

      expect(mockCreateSession).toHaveBeenCalledWith({
        testId: 'TEST-001',
        testName: 'Login Test',
        testDescription: 'Test user login flow',
      });
    });

    it('should parse optional --priority flag', async () => {
      mockCreateSession.mockResolvedValue({
        sessionId: 'TEST-001-123',
        testId: 'TEST-001',
        testName: 'Login Test',
        recordingPath: '/path/to/recording',
      });

      await cli.handleCommand('create', [
        '--id',
        'TEST-001',
        '--name',
        'Login Test',
        '--priority',
        'High',
      ]);

      expect(mockCreateSession).toHaveBeenCalledWith({
        testId: 'TEST-001',
        testName: 'Login Test',
        priority: 'High',
      });
    });

    it('should parse optional --tags flag (comma-separated)', async () => {
      mockCreateSession.mockResolvedValue({
        sessionId: 'TEST-001-123',
        testId: 'TEST-001',
        testName: 'Login Test',
        recordingPath: '/path/to/recording',
      });

      await cli.handleCommand('create', [
        '--id',
        'TEST-001',
        '--name',
        'Login Test',
        '--tags',
        'login, auth, smoke',
      ]);

      expect(mockCreateSession).toHaveBeenCalledWith({
        testId: 'TEST-001',
        testName: 'Login Test',
        tags: ['login', 'auth', 'smoke'],
      });
    });

    it('should parse optional --url flag', async () => {
      mockCreateSession.mockResolvedValue({
        sessionId: 'TEST-001-123',
        testId: 'TEST-001',
        testName: 'Login Test',
        recordingPath: '/path/to/recording',
      });

      await cli.handleCommand('create', [
        '--id',
        'TEST-001',
        '--name',
        'Login Test',
        '--url',
        'https://example.com/login',
      ]);

      expect(mockCreateSession).toHaveBeenCalledWith({
        testId: 'TEST-001',
        testName: 'Login Test',
        url: 'https://example.com/login',
      });
    });

    it('should parse optional --data flag (key=value pairs)', async () => {
      mockCreateSession.mockResolvedValue({
        sessionId: 'TEST-001-123',
        testId: 'TEST-001',
        testName: 'Login Test',
        recordingPath: '/path/to/recording',
      });

      await cli.handleCommand('create', [
        '--id',
        'TEST-001',
        '--name',
        'Login Test',
        '--data',
        'username=test@example.com',
        '--data',
        'password=secret123',
      ]);

      expect(mockCreateSession).toHaveBeenCalledWith({
        testId: 'TEST-001',
        testName: 'Login Test',
        testData: {
          username: 'test@example.com',
          password: 'secret123',
        },
      });
    });

    it('should throw error when --id is missing', async () => {
      await expect(cli.handleCommand('create', ['--name', 'Login Test'])).rejects.toThrow(
        'Required flags: --id, --name'
      );
    });

    it('should throw error when --name is missing', async () => {
      await expect(cli.handleCommand('create', ['--id', 'TEST-001'])).rejects.toThrow(
        'Required flags: --id, --name'
      );
    });
  });

  describe('add-step command', () => {
    it('should parse required flags --session and --step', async () => {
      mockAddStep.mockResolvedValue({
        sessionId: 'TEST-001-123',
        stepNumber: 2,
        description: 'Click login button',
        success: true,
        result: 'Clicked successfully',
        beforeScreenshot: '/path/to/before.png',
        afterScreenshot: '/path/to/after.png',
      });

      await cli.handleCommand('add-step', [
        '--session',
        'TEST-001-123',
        '--step',
        'Click login button',
      ]);

      expect(mockAddStep).toHaveBeenCalledWith({
        sessionId: 'TEST-001-123',
        stepDescription: 'Click login button',
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Processing step: "Click login button"')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Step 2 recorded successfully')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('TEST-001-123'));
    });

    it('should throw error when --session is missing', async () => {
      await expect(cli.handleCommand('add-step', ['--step', 'Click button'])).rejects.toThrow(
        'Required flags: --session, --step'
      );
    });

    it('should throw error when --step is missing', async () => {
      await expect(cli.handleCommand('add-step', ['--session', 'TEST-001-123'])).rejects.toThrow(
        'Required flags: --session, --step'
      );
    });
  });

  describe('generate command', () => {
    it('should parse required flag --session', async () => {
      mockGenerateTest.mockResolvedValue({
        sessionId: 'TEST-001-123',
        testFilePath: '/path/to/tests/test-001-recorded-test.ts',
        htmlReportPath: '/path/to/recording/recording-report.html',
        totalSteps: 5,
        duration: 2500,
      });

      await cli.handleCommand('generate', ['--session', 'TEST-001-123']);

      expect(mockGenerateTest).toHaveBeenCalledWith({
        sessionId: 'TEST-001-123',
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Generating test file'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Test file created: /path/to/tests/test-001-recorded-test.ts')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('TEST-001-123'));
    });

    it('should parse optional --output-dir flag', async () => {
      mockGenerateTest.mockResolvedValue({
        sessionId: 'TEST-001-123',
        testFilePath: '/path/to/custom/test-001-recorded-test.ts',
        htmlReportPath: '/path/to/recording/recording-report.html',
        totalSteps: 3,
        duration: 1500,
      });

      await cli.handleCommand('generate', ['--session', 'TEST-001-123', '--output-dir', 'custom-tests']);

      expect(mockGenerateTest).toHaveBeenCalledWith({
        sessionId: 'TEST-001-123',
        outputDir: 'custom-tests',
      });
    });

    it('should throw error when --session is missing', async () => {
      await expect(cli.handleCommand('generate', ['--output-dir', 'tests'])).rejects.toThrow(
        'Required flag: --session'
      );
    });
  });

  describe('list command', () => {
    it('should list all sessions as JSON', async () => {
      mockListSessions.mockResolvedValue({
        sessions: [
          {
            sessionId: 'TEST-001-123',
            testId: 'TEST-001',
            testName: 'Login Test',
            createdAt: '2026-01-01T10:00:00.000Z',
            stepCount: 3,
            status: 'completed',
            recordingPath: '/path/to/recording',
          },
          {
            sessionId: 'TEST-002-456',
            testId: 'TEST-002',
            testName: 'Signup Test',
            createdAt: '2026-01-02T10:00:00.000Z',
            stepCount: 5,
            status: 'in-progress',
            recordingPath: '/path/to/recording2',
          },
        ],
      });

      await cli.handleCommand('list', []);

      expect(mockListSessions).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('TEST-001-123')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('TEST-002-456')
      );
    });

    it('should handle empty sessions list', async () => {
      mockListSessions.mockResolvedValue({ sessions: [] });

      await cli.handleCommand('list', []);

      expect(mockListSessions).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[]'));
    });
  });

  describe('status command', () => {
    it('should get session status with required --session flag', async () => {
      mockGetSessionStatus.mockResolvedValue({
        sessionId: 'TEST-001-123',
        testId: 'TEST-001',
        testName: 'Login Test',
        createdAt: '2026-01-01T10:00:00.000Z',
        stepCount: 4,
        status: 'in-progress',
        recordingPath: '/path/to/recording',
      });

      await cli.handleCommand('status', ['--session', 'TEST-001-123']);

      expect(mockGetSessionStatus).toHaveBeenCalledWith('TEST-001-123');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('TEST-001-123')
      );
    });

    it('should throw error when --session is missing', async () => {
      await expect(cli.handleCommand('status', [])).rejects.toThrow('Required flag: --session');
    });
  });

  describe('unknown command', () => {
    it('should throw error for unknown subcommand', async () => {
      await expect(cli.handleCommand('invalid-command', [])).rejects.toThrow(
        'Unknown recorder command: invalid-command'
      );
    });
  });

  describe('JSON output format', () => {
    it('should output valid JSON to stdout', async () => {
      mockGetSessionStatus.mockResolvedValue({
        sessionId: 'TEST-001-123',
        testId: 'TEST-001',
        testName: 'Login Test',
        createdAt: '2026-01-01T10:00:00.000Z',
        stepCount: 2,
        status: 'completed',
        recordingPath: '/path/to/recording',
      });

      await cli.handleCommand('status', ['--session', 'TEST-001-123']);

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];

      // Should be valid JSON
      expect(() => JSON.parse(output)).not.toThrow();

      const parsed = JSON.parse(output);
      expect(parsed.sessionId).toBe('TEST-001-123');
      expect(parsed.status).toBe('completed');
    });
  });

  describe('user feedback to stderr', () => {
    it('should output user feedback to stderr for create command', async () => {
      mockCreateSession.mockResolvedValue({
        sessionId: 'TEST-001-123',
        testId: 'TEST-001',
        testName: 'Login Test',
        recordingPath: '/path/to/recording',
      });

      await cli.handleCommand('create', ['--id', 'TEST-001', '--name', 'Login Test']);

      // User feedback should go to stderr
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('🎬'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('✅'));
    });

    it('should output user feedback to stderr for add-step command', async () => {
      mockAddStep.mockResolvedValue({
        sessionId: 'TEST-001-123',
        stepNumber: 1,
        description: 'Navigate to login',
        success: true,
        result: 'Success',
        beforeScreenshot: '/path/to/before.png',
        afterScreenshot: '/path/to/after.png',
      });

      await cli.handleCommand('add-step', [
        '--session',
        'TEST-001-123',
        '--step',
        'Navigate to login',
      ]);

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('🤖'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('✅'));
    });

    it('should output user feedback to stderr for generate command', async () => {
      mockGenerateTest.mockResolvedValue({
        sessionId: 'TEST-001-123',
        testFilePath: '/path/to/test.ts',
        htmlReportPath: '/path/to/report.html',
        totalSteps: 3,
        duration: 1000,
      });

      await cli.handleCommand('generate', ['--session', 'TEST-001-123']);

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('📝'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('✅'));
    });
  });
});
