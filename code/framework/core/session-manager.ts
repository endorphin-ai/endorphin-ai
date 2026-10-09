/**
 * Session Manager
 * Handles test session lifecycle, state management, and persistence
 */

import { existsSync, promises as fs } from 'node:fs';
import * as path from 'node:path';
import type {
  DataGenerationResult,
  TestReport,
  TestSession,
  TestSetupResult,
  TestStep,
} from '../types/index.js';
import { globalLogger, logWithIcon, LogLevel } from './logger.js';
import { createTestSession, saveTestSession } from './test-session.js';
import { cleanupSnapshotDir } from '../ai/context/snapshot-store.js';

export interface SessionManagerConfig {
  resultBaseDir: string;
  recorderBaseDir: string;
  enableRecorderCopy: boolean;
}

export class SessionManager {
  private currentTestSession: TestSession | null = null;
  private config: SessionManagerConfig;
  private logger = globalLogger.createChild('SessionManager');

  constructor(config: SessionManagerConfig) {
    this.config = config;
  }

  /**
   * Initialize directories
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing session manager');

    await this.ensureDirectories();
    this.cleanupDirectories();

    this.logger.info('Session manager initialized');
  }

  /**
   * Create a new test session
   */
  async createSession(testName: string, testId: string | null = null): Promise<TestSession> {
    this.logger.info(`Creating new test session: ${testName}`, { testId });

    try {
      this.currentTestSession = await createTestSession(
        testName,
        testId,
        this.config.resultBaseDir
      );

      logWithIcon(LogLevel.DEBUG, 'debug', 'Test session created', {
        sessionId: this.currentTestSession.sessionId,
        sessionDir: this.currentTestSession.sessionDir,
      }, 'SessionManager');

      return this.currentTestSession;
    } catch (error: any) {
      this.logger.error('Failed to create test session', error, { testName, testId });
      throw error;
    }
  }

  /**
   * Get current test session
   */
  getCurrentSession(): TestSession | null {
    return this.currentTestSession;
  }

  /**
   * Require current session (throws if not exists)
   */
  requireCurrentSession(): TestSession {
    if (!this.currentTestSession) {
      throw new Error('No active test session. Create a session first.');
    }
    return this.currentTestSession;
  }

  /**
   * Add a step to the current session
   */
  addStep(step: TestStep): void {
    const session = this.requireCurrentSession();

    logWithIcon(LogLevel.DEBUG, 'debug', 'Adding step to session', {
      stepNumber: step.stepNumber,
      description: step.description,
      status: step.status,
    }, 'SessionManager');

    session.steps.push(step);
  }

  /**
   * Update session result
   */
  updateSessionResult(success: boolean, error?: string, report?: TestReport): void {
    const session = this.requireCurrentSession();

    this.logger.info(`Updating session result: ${success ? 'SUCCESS' : 'FAILED'}`, {
      sessionId: session.sessionId,
      error: error || 'none',
    });

    session.endTime = new Date().toISOString();
    session.status = success ? 'SUCCESS' : 'FAILED';
    session.duration = Date.now() - new Date(session.startTime).getTime();

    if (error) {
      (session as any).error = error;
    }

    if (report) {
      (session as any).report = report;
    }
  }

  /**
   * Update session with test setup result
   */
  updateSessionSetup(setupResult: TestSetupResult): void {
    const session = this.requireCurrentSession();

    this.logger.info(
      `Updating session with setup result: ${setupResult.success ? 'SUCCESS' : 'FAILED'}`,
      {
        sessionId: session.sessionId,
        executionTime: setupResult.executionTime,
        hasData: !!setupResult.data,
        error: setupResult.error?.message || 'none',
      }
    );

    // Store the setup result in the session
    session.setupResult = setupResult;

    logWithIcon(LogLevel.DEBUG, 'debug', 'Session setup result stored successfully', {
      sessionId: session.sessionId,
      setupSuccess: setupResult.success,
    }, 'SessionManager');
  }

  /**
   * Update session with data generation result
   */
  updateSessionDataGeneration(dataResult: DataGenerationResult): void {
    const session = this.requireCurrentSession();

    this.logger.info(
      `Updating session with data generation result: ${dataResult.success ? 'SUCCESS' : 'FAILED'}`,
      {
        sessionId: session.sessionId,
        executionTime: dataResult.executionTime,
        hasData: !!dataResult.data,
        tokenUsage: dataResult.tokenUsage?.totalTokens || 0,
        cost: dataResult.tokenUsage?.cost || 0,
        error: dataResult.error?.message || 'none',
      }
    );

    // Store the data generation result in the session
    session.dataGenerationResult = dataResult;

    logWithIcon(LogLevel.DEBUG, 'debug', 'Session data generation result stored successfully', {
      sessionId: session.sessionId,
      dataGenerationSuccess: dataResult.success,
      totalTokens: dataResult.tokenUsage?.totalTokens || 0,
    }, 'SessionManager');
  }

  /**
   * Update session with validation conclusion
   */
  updateSessionConclusion(conclusion: string): void {
    const session = this.requireCurrentSession();

    this.logger.info('Updating session with validation conclusion', {
      sessionId: session.sessionId,
      conclusionLength: conclusion.length,
    });

    // Store the conclusion in the session
    session.conclusion = conclusion;

    logWithIcon(LogLevel.DEBUG, 'debug', 'Session conclusion stored successfully', {
      sessionId: session.sessionId,
    }, 'SessionManager');
  }

  /**
   * Save current session
   */
  async saveSession(): Promise<void> {
    const session = this.requireCurrentSession();

    this.logger.info('Saving test session', { sessionId: session.sessionId });

    try {
      await saveTestSession(session);
      logWithIcon(LogLevel.DEBUG, 'debug', 'Test session saved successfully', {}, 'SessionManager');
    } catch (error: any) {
      this.logger.error('Failed to save test session', error);
      throw error;
    }
  }

  /**
   * Complete current session (update result and save)
   */
  async completeSession(success: boolean, error?: string, report?: TestReport): Promise<void> {
    this.logger.info(`Completing session: ${success ? 'SUCCESS' : 'FAILED'}`);

    this.updateSessionResult(success, error, report);
    await this.saveSession();

    // Clean up accessibility tree snapshots from .endorphin-tmp/
    try {
      await cleanupSnapshotDir();
    } catch (cleanupError: unknown) {
      const message = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      this.logger.warn(`Failed to cleanup snapshot directory: ${message}`);
    }

    this.logger.info('Session completed and saved');
  }

  /**
   * Close current session
   */
  closeSession(): void {
    if (this.currentTestSession) {
      logWithIcon(LogLevel.DEBUG, 'debug', 'Closing current session', {
        sessionId: this.currentTestSession.sessionId,
      }, 'SessionManager');
      this.currentTestSession = null;
    }
  }

  /**
   * Get session directory for current session
   */
  getSessionDirectory(): string {
    const session = this.requireCurrentSession();
    return session.sessionDir;
  }

  /**
   * Get session ID for current session
   */
  getSessionId(): string {
    const session = this.requireCurrentSession();
    return session.sessionId;
  }

  /**
   * Check if session is active
   */
  hasActiveSession(): boolean {
    return this.currentTestSession !== null;
  }

  /**
   * Get session statistics
   */
  getSessionStats() {
    const session = this.requireCurrentSession();

    const totalSteps = session.steps.length;
    const successfulSteps = session.steps.filter((step) => step.status === 'SUCCESS').length;
    const failedSteps = totalSteps - successfulSteps;

    return {
      sessionId: session.sessionId,
      testName: session.testName,
      duration: session.duration,
      totalSteps,
      successfulSteps,
      failedSteps,
      success: session.status === 'SUCCESS',
      startTime: session.startTime,
      endTime: session.endTime,
    };
  }

  /**
   * Ensure required directories exist
   */
  private async ensureDirectories(): Promise<void> {
    const directories = [this.config.resultBaseDir, this.config.recorderBaseDir];

    for (const dir of directories) {
      if (!existsSync(dir)) {
        logWithIcon(LogLevel.DEBUG, 'debug', `Creating directory: ${dir}`, {}, 'SessionManager');
        await fs.mkdir(dir, { recursive: true });
      }
    }
  }

  /**
   * Clean up old directories
   */
  private cleanupDirectories(): void {
    // This could be expanded to implement cleanup policies
    logWithIcon(LogLevel.DEBUG, 'debug', 'Directory cleanup completed', {}, 'SessionManager');
  }

  /**
   * Copy recorder files if enabled
   */
  async copyRecorderFiles(): Promise<void> {
    if (!this.config.enableRecorderCopy) {
      return;
    }

    const session = this.requireCurrentSession();
    const sourceDir = this.config.recorderBaseDir;
    const targetDir = path.join(session.sessionDir, 'recorder');

    if (!existsSync(sourceDir)) {
      logWithIcon(LogLevel.DEBUG, 'debug', 'No recorder directory to copy', {}, 'SessionManager');
      return;
    }

    logWithIcon(LogLevel.DEBUG, 'debug', 'Copying recorder files', { sourceDir, targetDir }, 'SessionManager');

    try {
      await fs.mkdir(targetDir, { recursive: true });
      await this.copyDirectory(sourceDir, targetDir);
      logWithIcon(LogLevel.DEBUG, 'debug', 'Recorder files copied successfully', {}, 'SessionManager');
    } catch (error: any) {
      this.logger.error('Failed to copy recorder files', error);
    }
  }

  /**
   * Recursively copy directory
   */
  private async copyDirectory(source: string, target: string): Promise<void> {
    const entries = await fs.readdir(source, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const targetPath = path.join(target, entry.name);

      if (entry.isDirectory()) {
        await fs.mkdir(targetPath, { recursive: true });
        await this.copyDirectory(sourcePath, targetPath);
      } else {
        await fs.copyFile(sourcePath, targetPath);
      }
    }
  }
}
