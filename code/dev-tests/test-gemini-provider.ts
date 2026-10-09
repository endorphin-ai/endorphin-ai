/**
 * Test script to verify Gemini provider implementation
 * Run with: npx tsx dev-tests/test-gemini-provider.ts
 */

import { AIProviderFactory } from '../framework/ai/providers/provider-factory.js';
import { GeminiProvider } from '../framework/ai/providers/gemini-provider.js';
import { OpenAIProvider } from '../framework/ai/providers/openai-provider.js';
import type { ProviderConfig } from '../framework/ai/providers/base-provider.js';

console.log('🧪 Testing Gemini Provider Implementation\n');

// Test 1: Provider Detection
console.log('1️⃣ Testing provider detection:');
const testModels = [
  'gpt-4o',
  'gpt-3.5-turbo',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'claude-3-opus',
  'unknown-model'
];

testModels.forEach(model => {
  const provider = AIProviderFactory.detectProvider(model);
  console.log(`   ${model} → ${provider}`);
});

// Test 2: Provider Creation
console.log('\n2️⃣ Testing provider creation:');

try {
  // Test OpenAI provider
  const openaiConfig: ProviderConfig = {
    model: 'gpt-4o',
    temperature: 0.1,
    maxRetries: 3
  };
  
  const openaiProvider = AIProviderFactory.create(openaiConfig);
  console.log(`   ✅ OpenAI provider created for model: ${openaiConfig.model}`);
  console.log(`      Provider name: ${openaiProvider.getProviderName()}`);
  
  // Test Gemini provider
  const geminiConfig: ProviderConfig = {
    model: 'gemini-1.5-pro',
    temperature: 0.1,
    maxRetries: 3
  };
  
  const geminiProvider = AIProviderFactory.create(geminiConfig);
  console.log(`   ✅ Gemini provider created for model: ${geminiConfig.model}`);
  console.log(`      Provider name: ${geminiProvider.getProviderName()}`);
  
} catch (error) {
  console.error('   ❌ Error creating provider:', error);
}

// Test 3: Model Support Check
console.log('\n3️⃣ Testing model support:');

const modelsToCheck = [
  'gpt-4o',
  'gemini-1.5-pro',
  'gemini-2.0-flash',
  'gemini-1.5-flash-latest',
  'claude-3-opus'
];

modelsToCheck.forEach(model => {
  const isSupported = AIProviderFactory.isModelSupported(model);
  console.log(`   ${model}: ${isSupported ? '✅ Supported' : '❌ Not supported'}`);
});

// Test 4: Token Usage Calculation
console.log('\n4️⃣ Testing token usage calculation:');

const geminiProvider = new GeminiProvider({
  model: 'gemini-1.5-pro',
  temperature: 0.1
});

const promptText = 'This is a test prompt for token calculation.';
const responseText = 'This is a test response from the AI model to verify token counting.';

const tokenUsage = geminiProvider.calculateTokenUsage(
  {}, // Empty response object for testing
  promptText,
  responseText
);

console.log('   Token usage for Gemini:');
console.log(`   - Prompt tokens: ${tokenUsage.promptTokens}`);
console.log(`   - Response tokens: ${tokenUsage.responseTokens}`);
console.log(`   - Total tokens: ${tokenUsage.totalTokens}`);
console.log(`   - Estimated cost: $${tokenUsage.cost.toFixed(6)}`);
console.log(`   - Model: ${tokenUsage.model}`);

// Test 5: Configuration Validation
console.log('\n5️⃣ Testing configuration validation:');

const testConfigs = [
  {
    name: 'Valid Gemini config',
    config: { model: 'gemini-1.5-pro', apiKey: 'test-key' }
  },
  {
    name: 'Missing API key',
    config: { model: 'gemini-1.5-pro' }
  },
  {
    name: 'Invalid model',
    config: { model: 'invalid-model', apiKey: 'test-key' }
  }
];

testConfigs.forEach(test => {
  try {
    const provider = new GeminiProvider(test.config as ProviderConfig);
    const validation = provider.validateConfig();
    
    if (validation.isValid) {
      console.log(`   ✅ ${test.name}: Valid`);
    } else {
      console.log(`   ⚠️ ${test.name}: ${validation.error}`);
    }
  } catch (error) {
    console.log(`   ❌ ${test.name}: Error during creation`);
  }
});

// Test 6: Supported Models List
console.log('\n6️⃣ All supported models:');
const supportedModels = AIProviderFactory.getSupportedModels();
console.log('   OpenAI models:');
supportedModels.filter(m => m.startsWith('gpt')).forEach(m => console.log(`     - ${m}`));
console.log('   Gemini models:');
supportedModels.filter(m => m.startsWith('gemini')).forEach(m => console.log(`     - ${m}`));

console.log('\n✨ Gemini provider testing complete!');
console.log('\n📝 To use Gemini in your tests:');
console.log('   1. Set GOOGLE_API_KEY or GEMINI_API_KEY environment variable');
console.log('   2. Update endorphin.config.ts with model: "gemini-1.5-pro"');
console.log('   3. Run your tests as usual');