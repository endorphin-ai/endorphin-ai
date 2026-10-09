/**
 * Interactive Test Recorder
 * Provides interactive test recording with AI agent execution
 */

import { EnhancedBrowserTestFramework } from '../automation/browser/browser-framework.js';
import type { FrameworkConfig } from '../types/index.js';
import dotenv from 'dotenv';
import readline from 'readline';
import { TestRecorder } from './session-recorder.js';

// Load environment variables
dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/**
 * Promisified readline question
 * @param question - Question to ask
 * @returns Promise resolving to user's answer
 */
function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

/**
 * Test data interface
 */
interface TestData {
  id: string;
  name: string;
  description: string;
  priority: string;
  tags: string[];
  site: string;
  testData: Record<string, any>;
}

/**
 * Collect test data from user input
 * @returns Promise resolving to test data or null if cancelled
 */
async function collectTestData(): Promise<TestData | null> {
  console.log('\n📋 Test Data Collection');
  console.log('═'.repeat(40));

  const testData: Partial<TestData> = {};

  // Required fields with validation
  do {
    testData.id = await askQuestion('Test ID (e.g., QE-012): ');
    if (!testData.id?.trim()) {
      console.log('❌ Test ID is required! Please enter a valid ID.');
    }
  } while (!testData.id?.trim());

  do {
    testData.name = await askQuestion('Test Name: ');
    if (!testData.name?.trim()) {
      console.log('❌ Test Name is required! Please enter a valid name.');
    }
  } while (!testData.name?.trim());

  do {
    testData.description = await askQuestion('Test Description: ');
    if (!testData.description?.trim()) {
      console.log('❌ Test Description is required! Please enter a valid description.');
    }
  } while (!testData.description?.trim());

  // Optional fields
  const priority = await askQuestion('Priority (High/Medium/Low) [Medium]: ');
  testData.priority = priority || 'Medium';

  const tags = await askQuestion('Tags (comma-separated): ');
  testData.tags = tags ? tags.split(',').map((tag) => tag.trim()) : [];

  // Site URL (use env variable as default)
  const defaultSite = process.env.BASE_URL || 'https://qafromla.herokuapp.com/';
  const site = await askQuestion(`Site URL [${defaultSite}]: `);
  testData.site = site || defaultSite;

  // Collect test data object - only key-value pairs
  console.log('\n🔧 Test Data (key=value format)');
  console.log('Enter key=value pairs, or press Enter to finish');

  const testDataObj: Record<string, any> = {};

  while (true) {
    const customField = await askQuestion('Key=value (or Enter to finish): ');
    if (!customField) break;

    const [key, ...valueParts] = customField.split('=');
    const value = valueParts.join('=');
    if (key && value) {
      testDataObj[key.trim()] = value.trim();
    } else {
      console.log('⚠️ Invalid format. Use: key=value');
    }
  }

  testData.testData = testDataObj;

  // Display collected data in proper format
  console.log('\n📊 Collected Test Data:');
  console.log('═'.repeat(40));
  
  // Show basic test info
  console.log(`Test ID: ${testData.id}`);
  console.log(`Name: ${testData.name}`);
  console.log(`Description: ${testData.description}`);
  console.log(`Priority: ${testData.priority}`);
  console.log(`Tags: [${testData.tags?.join(', ')}]`);
  console.log(`Site: ${testData.site}`);
  
  // Show data function format
  if (Object.keys(testData.testData || {}).length > 0) {
    console.log('\nData function:');
    console.log('data: async () => {');
    console.log('  return {');
    for (const [key, value] of Object.entries(testData.testData || {})) {
      console.log(`    ${key}: '${value}',`);
    }
    console.log('  };');
    console.log('}');
  } else {
    console.log('\nData function:');
    console.log('data: async () => {');
    console.log('  return {};');
    console.log('}');
  }

  const confirm = await askQuestion('\nConfirm test data? (y/n): ');
  if (confirm.toLowerCase() !== 'y') {
    console.log('❌ Test data collection cancelled');
    return null;
  }

  return testData as TestData;
}

/**
 * Run the interactive test recorder
 * @param config - Framework configuration
 */
export async function runInteractiveRecorder(config: Partial<FrameworkConfig> = {}): Promise<void> {
  console.log('\n🎬 Interactive Test Recorder');
  console.log('═'.repeat(50));
  console.log('Record browser interactions step by step!');
  console.log('Commands:');
  console.log('• Type natural language commands (e.g., "click login button")');
  console.log('• Type "done" to stop recording and generate test');
  console.log('• Each step will be recorded with screenshots');
  console.log('═'.repeat(50));

  // Collect test data first
  const testData = await collectTestData();
  if (!testData) {
    console.log('👋 Exiting...');
    rl.close();
    return;
  }

  // Create framework with the config from CLI
  const framework = new EnhancedBrowserTestFramework(config);
  const recorder = new TestRecorder(framework, testData);

  try {
    // Initialize framework
    console.log('\n🚀 Initializing browser...');
    await framework.initialize();

    // Start recording
    await recorder.startRecording();

    // Navigate to the site using the framework's runTask method
    console.log(`\n🌐 Navigating to: ${testData.site}`);
    console.log('🔧 Checking AI configuration...');
    
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.log('⚠️ Warning: OPENAI_API_KEY not found in environment');
    } else {
      console.log('✅ OpenAI API key found');
    }
    
    try {
      const navResult = await framework.runTask(`Navigate to ${testData.site}`, 'navigation');
      
      console.log('📊 Navigation Result:');
      console.log(`- Status: ${navResult.status || 'N/A'}`);
      console.log(`- Result: ${navResult.result || 'N/A'}`);
      
      // Only show error if there actually is one
      if (navResult.error && navResult.error !== 'None') {
        console.log(`- Error: ${navResult.error}`);
      }
      
      // Improved success detection - check for successful navigation indicators
      const isNavigationSuccessful = navResult.success === true || 
                                    navResult.status === 'SUCCESS' ||
                                    (navResult.result && navResult.result.includes('Successfully navigated')) ||
                                    (!navResult.error || navResult.error === 'None');
      
      if (isNavigationSuccessful) {
        console.log('✅ Navigation successful! Browser should now show the target site.');
      } else {
        console.log('❌ Navigation failed! Browser may show empty page.');
        if (navResult.error && navResult.error !== 'None') {
          console.log(`   Error details: ${navResult.error}`);
        }
      }

      // Record the navigation step
      await recorder.recordStep(
        `Navigate to ${testData.site}`,
        'navigate',
        { url: testData.site },
        navResult.result || 'Navigation completed'
      );

      // Show browser popup notification for navigation step
      if (isNavigationSuccessful) {
        await showStepRecordedNotification(framework, `Navigate to ${testData.site}`, 'Navigation completed successfully');
      }
    } catch (error: any) {
      console.error('💥 Navigation Error:', error.message);
      console.log('🔍 This may be due to:');
      console.log('- Missing or invalid OpenAI API key');
      console.log('- AI agent configuration issues');
      console.log('- Network connectivity problems');
      
      // Still record the failed attempt
      await recorder.recordStep(
        `Navigate to ${testData.site}`,
        'error',
        { error: error.message },
        `Navigation failed: ${error.message}`
      );
    }

    console.log('\n💬 Ready for interactive commands!');
    console.log('Type your commands or "done" to finish recording.\n');

    // Interactive command loop
    while (true) {
      const prompt = await askQuestion('🎬 Next step: ');

      if (prompt.toLowerCase() === 'done') {
        console.log('\n🛑 Stopping recording...');
        break;
      }

      if (!prompt.trim()) {
        console.log('⚠️ Please enter a command or "done" to finish.');
        continue;
      }

      try {
        // Execute the command using the framework's AI agent
        console.log(`\n🤖 Processing: "${prompt}"`);
        console.log('⏳ Sending command to AI agent...');

        // Use the AI agent to interpret and execute the command
        const result = await framework.runTask(prompt, `Interactive-Step-${Date.now()}`);

        console.log('📊 Command Result:');
        console.log(`- Status: ${result.status || 'N/A'}`);
        console.log(`- Result: ${result.result || 'N/A'}`);
        
        // Only show error if there actually is one
        if (result.error && result.error !== 'None') {
          console.log(`- Error: ${result.error}`);
        }

        // Parse AI agent result to detect real success/failure
        let isCommandSuccessful = false;
        let agentStatus = 'unknown';
        
        try {
          // Try to parse JSON result from AI agent
          const resultText = result.result || '';
          if (resultText.includes('"status"')) {
            const jsonMatch = resultText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsedResult = JSON.parse(jsonMatch[0]);
              agentStatus = parsedResult.status || 'unknown';
              
              // AI agent explicitly reports success/failure in JSON
              isCommandSuccessful = agentStatus === 'completed' || 
                                  agentStatus === 'success' ||
                                  parsedResult.isComplete === true;
              
              // If status is explicitly "failed" or "error", it's definitely a failure
              if (agentStatus === 'failed' || agentStatus === 'error' || parsedResult.action === 'error') {
                isCommandSuccessful = false;
              }
            }
          } else {
            // Fallback: check for obvious error indicators
            isCommandSuccessful = !resultText.includes('❌') && 
                                !resultText.includes('not found') && 
                                !resultText.includes('failed') &&
                                !resultText.includes('error');
          }
        } catch {
          // If parsing fails, use simple heuristics
          isCommandSuccessful = result.status === 'SUCCESS' && 
                              !result.result?.includes('❌') && 
                              !result.result?.includes('failed');
        }

        if (isCommandSuccessful) {
          console.log(`✅ Step completed successfully!`);
          
          // Record successful step
          await recorder.recordStep(
            prompt,
            'ai-agent',
            { command: prompt },
            result.result || 'Command executed by AI agent'
          );

          // Show browser popup notification for successful step recording
          await showStepRecordedNotification(framework, prompt, 'Step recorded successfully');
          
        } else {
          console.log(`❌ Step failed! AI agent status: "${agentStatus}"`);
          console.log(`🔄 Try a different command or be more specific about the element.`);
          console.log(`💡 Tip: Look at the page and try describing the element differently.`);
          
          // DO NOT record failed steps
          console.log(`📝 Step not recorded due to failure.`);
        }

      } catch (error: any) {
        console.log(`💥 Error executing command: ${error.message}`);
        console.log('🔍 This may be due to:');
        console.log('- AI agent unable to interpret the command');
        console.log('- Browser element not found or accessible');
        console.log('- Network or API connectivity issues');

        // Still record the failed attempt
        await recorder.recordStep(
          prompt,
          'error',
          { error: error.message },
          `Error: ${error.message}`
        );
      }
    }

    // Stop recording and generate files
    const recordingResult = await recorder.stopRecording();

    if (recordingResult) {
      console.log('\n🎉 Recording Complete!');
      console.log('═'.repeat(40));
      console.log(`📁 Recording ID: ${recordingResult.recordingId}`);
      console.log(`📂 Artifacts: ${recordingResult.recordingPath}`);
      console.log(`🧪 Steps recorded: ${recordingResult.steps}`);
      console.log(`📝 Test file generated in recording folder`);
    } else {
      console.log('\n⚠️ Recording completed but no result data available');
    }
  } catch (error: any) {
    console.error(`💥 Error in interactive recorder: ${error.message}`);
  } finally {
    await framework.cleanup();
    rl.close();
  }
}

/**
 * Show browser popup notification when a step is successfully recorded
 */
async function showStepRecordedNotification(framework: any, stepDescription: string, result: string): Promise<void> {
  try {
    if (!framework?.currentPage) {
      return;
    }

    const page = framework.currentPage;
    
    // Inject notification CSS and JavaScript
    await page.addStyleTag({
      content: `
        .endorphin-notification {
          position: fixed !important;
          top: 20px !important;
          right: 20px !important;
          background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%) !important;
          color: white !important;
          padding: 16px 24px !important;
          border-radius: 8px !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
          z-index: 999999 !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          font-size: 14px !important;
          font-weight: 500 !important;
          max-width: 400px !important;
          animation: endorphin-slide-in 0.3s ease-out !important;
          border: 2px solid #4CAF50 !important;
        }
        
        .endorphin-notification-title {
          font-weight: 600 !important;
          margin-bottom: 4px !important;
          display: flex !important;
          align-items: center !important;
        }
        
        .endorphin-notification-content {
          font-size: 12px !important;
          opacity: 0.9 !important;
          line-height: 1.4 !important;
        }
        
        @keyframes endorphin-slide-in {
          from {
            transform: translateX(100%) !important;
            opacity: 0 !important;
          }
          to {
            transform: translateX(0) !important;
            opacity: 1 !important;
          }
        }
        
        @keyframes endorphin-fade-out {
          from {
            opacity: 1 !important;
            transform: translateX(0) !important;
          }
          to {
            opacity: 0 !important;
            transform: translateX(100%) !important;
          }
        }
      `
    });

    // Create and show notification
    await page.evaluate((params: { stepDesc: string; resultText: string }) => {
      const { stepDesc, resultText } = params;
      
      // Remove any existing notifications
      const existing = document.querySelectorAll('.endorphin-notification');
      existing.forEach(el => el.remove());

      // Create new notification
      const notification = document.createElement('div');
      notification.className = 'endorphin-notification';
      notification.innerHTML = `
        <div class="endorphin-notification-title">
          ✅ Step Recorded Successfully
        </div>
        <div class="endorphin-notification-content">
          <strong>Action:</strong> ${stepDesc}<br>
          <strong>Result:</strong> ${resultText}
        </div>
      `;

      document.body.appendChild(notification);

      // Auto-remove after 3 seconds
      setTimeout(() => {
        if (notification.parentNode) {
          notification.style.animation = 'endorphin-fade-out 0.3s ease-in';
          setTimeout(() => {
            if (notification.parentNode) {
              notification.remove();
            }
          }, 300);
        }
      }, 3000);
    }, { stepDesc: stepDescription, resultText: result });

  } catch (error) {
    // Silently fail if notification can't be shown
    console.debug('🐞 Could not show browser notification:', error);
  }
}

// Export utility functions
export { collectTestData, showStepRecordedNotification };
