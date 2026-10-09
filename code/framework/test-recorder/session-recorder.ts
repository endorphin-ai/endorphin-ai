/**
 * Session Test Recorder
 * Records user interactions and generates test files
 */

import type { EnhancedBrowserTestFramework } from '../automation/browser/browser-framework.js';
import { DirectoryManager } from '../utils/directory-manager.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Test data interface for recording
 */
interface RecorderTestData {
  id?: string;
  name?: string;
  description?: string;
  priority?: string;
  tags?: string[];
  site?: string;
  testData?: Record<string, any>;
}

/**
 * Step information interface
 */
interface StepInfo {
  stepNumber: number;
  description: string;
  type: string;
  timestamp: string;
  data: any;
  result: string;
  beforeScreenshot: string;
  afterScreenshot: string;
}

/**
 * Recording result interface
 */
interface RecordingResult {
  recordingId: string;
  recordingPath: string;
  steps: number;
  duration: number;
  testFilePath: string;
}

/**
 * Session state for persistence
 */
export interface RecorderSessionState {
  sessionId: string;
  testData: RecorderTestData;
  createdAt: string;
  status: 'in-progress' | 'completed';
  stepCount: number;
  steps: StepInfo[];
  testFilePath?: string;
  /** CDP WebSocket endpoint for browser persistence across CLI invocations */
  browserWsEndpoint?: string;
}

/**
 * Interactive Test Recorder
 * Records user interactions and generates test files
 */
export class TestRecorder {
  private framework: EnhancedBrowserTestFramework;
  private testData: RecorderTestData;
  private steps: StepInfo[];
  private stepCounter: number;
  private recordingId: string | null;
  private recordingPath: string | null;
  private stepsPath: string | null;
  private isRecording: boolean;
  private startTime: Date | null;

  private recorderBaseDir: string;

  constructor(framework: EnhancedBrowserTestFramework, testData: RecorderTestData = {}, recorderBaseDir?: string) {
    this.framework = framework;
    this.testData = testData;
    this.recorderBaseDir = recorderBaseDir || path.join(process.cwd(), 'test-recorder');
    this.steps = [];
    this.stepCounter = 0;
    this.recordingId = null;
    this.recordingPath = null;
    this.stepsPath = null;
    this.isRecording = false;
    this.startTime = null;
  }

  /**
   * Get recorder base directory
   */
  get getRecorderBaseDir(): string {
    return this.recorderBaseDir;
  }

  /**
   * Start recording session
   * @returns Promise resolving to recording ID
   */
  async startRecording(): Promise<string> {
    this.startTime = new Date();
    const timestamp = Date.now();
    this.recordingId = `${this.testData.id || 'REC'}-${timestamp}`;

    // Clean up previous recordings first
    console.log('🧹 Cleaning up previous recordings...');
    await DirectoryManager.cleanupRecorderDirectory(this.recorderBaseDir);

    // Create recording directories in USER project (not framework)
    this.recordingPath = path.join(this.recorderBaseDir, this.recordingId);
    this.stepsPath = path.join(this.recordingPath, 'steps');

    await fs.mkdir(this.recordingPath, { recursive: true });
    await fs.mkdir(this.stepsPath, { recursive: true });

    this.isRecording = true;
    this.stepCounter = 0;
    this.steps = [];

    console.log('Recording session:', this.recordingId);
    console.log('Artifacts will be saved to:', this.recordingPath);

    return this.recordingId;
  }

  /**
   * Record a step with tool call and screenshot
   * @param description - Step description
   * @param type - Step type
   * @param data - Step data
   * @param result - Step result
   */
  async recordStep(description: string, type: string, data: any, result: string): Promise<void> {
    if (!this.isRecording) return;

    this.stepCounter++;
    const stepId = String(this.stepCounter).padStart(3, '0');
    const stepFolderName = `${stepId}-${this.sanitizeFileName(description)}`;
    const stepPath = path.join(this.stepsPath!, stepFolderName);

    // Create step folder
    await fs.mkdir(stepPath, { recursive: true });

    // Take BEFORE screenshot using the framework's browser manager
    const beforeScreenshot = path.join(stepPath, 'before.png');
    const browserManager = this.framework.getBrowserManager();
    if (browserManager) {
      await browserManager.takeScreenshot({ path: beforeScreenshot, fullPage: true });
    }

    // Record step info
    const stepInfo: StepInfo = {
      stepNumber: this.stepCounter,
      description,
      type,
      timestamp: new Date().toISOString(),
      data,
      result,
      beforeScreenshot: 'before.png',
      afterScreenshot: 'after.png',
    };

    // Take AFTER screenshot (small delay to ensure DOM updates)
    await new Promise((resolve) => setTimeout(resolve, 500));
    const afterScreenshot = path.join(stepPath, 'after.png');
    if (browserManager) {
      await browserManager.takeScreenshot({ path: afterScreenshot, fullPage: true });
    }

    // Save step data
    const stepDataPath = path.join(stepPath, 'step-data.json');
    await fs.writeFile(stepDataPath, JSON.stringify(stepInfo, null, 2));

    this.steps.push(stepInfo);

    console.log(`✅ Step ${this.stepCounter}: ${description}`);
  }

  /**
   * Stop recording and generate final artifacts
   * @returns Promise resolving to recording result
   */
  async stopRecording(): Promise<RecordingResult | undefined> {
    if (!this.isRecording || !this.recordingId || !this.recordingPath || !this.startTime) {
      console.warn('Recording was not active');
      return;
    }

    this.isRecording = false;
    const endTime = new Date();
    const duration = endTime.getTime() - this.startTime.getTime();

    // Generate session summary
    const sessionSummary = {
      recordingId: this.recordingId,
      testData: this.testData,
      startTime: this.startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration,
      totalSteps: this.stepCounter,
      steps: this.steps,
    };

    // Save session summary
    const sessionPath = path.join(this.recordingPath, 'recording-session.json');
    await fs.writeFile(sessionPath, JSON.stringify(sessionSummary, null, 2));

    // Generate test file
    const testFilePath = await this.generateTestFile();

    // Generate HTML report
    await this.generateHTMLReport();

    return {
      recordingId: this.recordingId,
      recordingPath: this.recordingPath,
      steps: this.stepCounter,
      duration,
      testFilePath,
    };
  }

  /**
   * Sanitize filename for safe usage
   * @param name - Filename to sanitize
   * @returns Sanitized filename
   */
  private sanitizeFileName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
  }

  /**
   * Generate HTML report for the recording session
   */
  private async generateHTMLReport(): Promise<void> {
    if (!this.recordingPath) return;

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Recording: ${this.testData.name || this.recordingId}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
        .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
        .step { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .step-header { font-weight: bold; color: #333; margin-bottom: 10px; }
        .screenshots { display: flex; gap: 20px; margin-top: 10px; }
        .screenshots img { max-width: 300px; border: 1px solid #ccc; }
        .step-data { background: #f9f9f9; padding: 10px; margin-top: 10px; border-radius: 3px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Test Recording Report</h1>
            <p><strong>Recording ID:</strong> ${this.recordingId}</p>
            <p><strong>Test Name:</strong> ${this.testData.name || 'N/A'}</p>
            <p><strong>Description:</strong> ${this.testData.description || 'N/A'}</p>
            <p><strong>Total Steps:</strong> ${this.stepCounter}</p>
            <p><strong>Generated:</strong> ${new Date().toISOString()}</p>
        </div>
        
        ${this.steps.map(step => `
        <div class="step">
            <div class="step-header">Step ${step.stepNumber}: ${step.description}</div>
            <p><strong>Type:</strong> ${step.type}</p>
            <p><strong>Result:</strong> ${step.result}</p>
            <p><strong>Timestamp:</strong> ${step.timestamp}</p>
            
            <div class="screenshots">
                <div>
                    <h4>Before</h4>
                    <img src="steps/${String(step.stepNumber).padStart(3, '0')}-${this.sanitizeFileName(step.description)}/before.png" alt="Before screenshot">
                </div>
                <div>
                    <h4>After</h4>
                    <img src="steps/${String(step.stepNumber).padStart(3, '0')}-${this.sanitizeFileName(step.description)}/after.png" alt="After screenshot">
                </div>
            </div>
            
            <div class="step-data">
                <h4>Step Data</h4>
                <pre>${JSON.stringify(step.data, null, 2)}</pre>
            </div>
        </div>
        `).join('')}
    </div>
</body>
</html>`;

    const htmlPath = path.join(this.recordingPath, 'recording-report.html');
    await fs.writeFile(htmlPath, htmlContent);
    console.log('HTML report generated:', htmlPath);
  }

  /**
   * Generate test file in recording directory
   * @returns Promise resolving to test file path
   */
  private async generateTestFile(): Promise<string> {
    if (!this.recordingPath) {
      throw new Error('Recording path not initialized');
    }
    
    const testId = this.testData.id || 'QE-NEW';
    const filename = `${testId.toLowerCase()}-recorded-test.ts`;

    // Create test file in the recording directory instead of tests/
    const testPath = path.join(this.recordingPath, filename);

    // Build task from recorded steps
    const taskSteps = this.steps
      .map((step, index) => {
        return `STEP ${index + 1}: ${step.description}`;
      })
      .join('\n      ');

    // Add "recorded" tag if not already present
    const tags = this.testData.tags || [];
    if (!tags.includes('recorded')) {
      tags.push('recorded');
    }

    // Generate test data object with proper structure
    const testDataObj = this.testData.testData || {};
    const hasTestData = Object.keys(testDataObj).length > 0;
    
    // Format test data as proper object for the data function
    const testDataStr = hasTestData 
      ? JSON.stringify(testDataObj, null, 6).replace(/^/gm, '    ')
      : '{}';

    const testContent = `// ${testId}: ${this.testData.name}
// Description: ${this.testData.description}
// Priority: ${this.testData.priority || 'Medium'}
// Tags: ${tags.join(', ')}
// Generated by Test Recorder: ${this.recordingId}

import type { TestCase } from 'endorphin-ai';

const recordedTest: TestCase = {
  id: '${testId}',
  name: '${this.testData.name}',
  description: '${this.testData.description}',
  priority: '${this.testData.priority || 'Medium'}',
  tags: ${JSON.stringify(tags, null, 2)},
  data: async () => {
    console.log('Using recorded test data...');
    return ${testDataStr};
  },

  task: async (data, setupData) => {
    return \`
      ${taskSteps}
      STEP ${this.stepCounter + 1}: Verify the test completed successfully
    \`;
  },
  // Recording metadata
  recordingId: '${this.recordingId}',
  recordedSteps: ${this.stepCounter}
};

export default recordedTest;
`;

    await fs.writeFile(testPath, testContent);
    console.log('Test file created:', filename);

    return testPath;
  }

  /**
   * Save current session state to disk
   * @param browserWsEndpoint - Optional CDP WebSocket endpoint for browser persistence
   */
  async saveState(browserWsEndpoint?: string): Promise<void> {
    if (!this.recordingId || !this.recordingPath) {
      throw new Error('No active recording session');
    }

    const state: RecorderSessionState = {
      sessionId: this.recordingId,
      testData: this.testData,
      createdAt: this.startTime?.toISOString() || new Date().toISOString(),
      status: this.isRecording ? 'in-progress' : 'completed',
      stepCount: this.stepCounter,
      steps: this.steps,
    };

    if (browserWsEndpoint) {
      state.browserWsEndpoint = browserWsEndpoint;
    }

    const statePath = path.join(this.recordingPath, 'session-state.json');
    await fs.writeFile(statePath, JSON.stringify(state, null, 2));
  }

  /**
   * Load session state from disk (static method)
   */
  static async loadState(
    sessionId: string,
    recorderBaseDir: string
  ): Promise<RecorderSessionState | null> {
    const statePath = path.join(recorderBaseDir, sessionId, 'session-state.json');

    try {
      const stateContent = await fs.readFile(statePath, 'utf8');
      return JSON.parse(stateContent) as RecorderSessionState;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Load recorder from existing session state
   */
  async loadFromState(sessionId: string): Promise<void> {
    const state = await TestRecorder.loadState(sessionId, this.recorderBaseDir);
    if (!state) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    this.recordingId = state.sessionId;
    this.recordingPath = path.join(this.recorderBaseDir, sessionId);
    this.stepsPath = path.join(this.recordingPath, 'steps');
    this.testData = state.testData;
    this.stepCounter = state.stepCount;
    this.steps = state.steps;
    this.isRecording = state.status === 'in-progress';
    this.startTime = new Date(state.createdAt);
  }

  /**
   * Update session status
   */
  async updateStateStatus(status: 'in-progress' | 'completed'): Promise<void> {
    if (!this.recordingPath) {
      throw new Error('No active recording session');
    }

    const statePath = path.join(this.recordingPath, 'session-state.json');
    const stateContent = await fs.readFile(statePath, 'utf8');
    const state = JSON.parse(stateContent) as RecorderSessionState;

    state.status = status;
    await fs.writeFile(statePath, JSON.stringify(state, null, 2));
  }
}
