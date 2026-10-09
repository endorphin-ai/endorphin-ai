/**
 * Global Setup Example
 *
 * This file runs before any tests are executed. Use it for:
 * - Environment setup and validation
 * - Authentication/login procedures
 * - Database seeding or cleanup
 * - External service setup
 * - Configuration validation
 *
 * The function should return a Promise that resolves if setup is successful.
 * If the promise rejects, all test execution will be stopped.
 *
 * To use this file, add it to your endorphin.config.ts:
 * globalSetup: './global-setup.ts'
 */

export default async function globalSetup(): Promise<void> {
  console.log('🚀 Starting global setup...');

  // Example 1: Environment validation
  await validateEnvironment();

  // Example 2: External service health check
  await checkExternalServices();

  // Example 3: Authentication setup
  await setupAuthentication();

  // Example 4: Database setup
  await setupDatabase();

  console.log('✅ Global setup completed successfully');
}

/**
 * Validate required environment variables
 */
async function validateEnvironment(): Promise<void> {
  console.log('📋 Validating environment...');

  const requiredEnvVars = [
    'OPENAI_API_KEY',
    // Add your required environment variables here
    // 'DATABASE_URL',
    // 'API_BASE_URL',
    // 'AUTH_TOKEN',
  ];

  const missing = requiredEnvVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Example: Validate environment configuration
  // await fetch(`${process.env.API_BASE_URL}/health`);
  await new Promise((resolve) => setTimeout(resolve, 10)); // Placeholder for async validation

  console.log('✓ Environment validation passed');
}

/**
 * Check external services are available
 */
async function checkExternalServices(): Promise<void> {
  console.log('🌐 Checking external services...');

  // Example: Check if API is responding
  // try {
  //   const response = await fetch(`${process.env.API_BASE_URL}/health`);
  //   if (!response.ok) {
  //     throw new Error(`API health check failed: ${response.status}`);
  //   }
  // } catch (error) {
  //   throw new Error(`Failed to connect to API: ${error}`);
  // }

  // Placeholder for async service checks
  await new Promise((resolve) => setTimeout(resolve, 10));

  console.log('✓ External services check passed');
}

/**
 * Setup authentication tokens or login
 */
async function setupAuthentication(): Promise<void> {
  console.log('🔐 Setting up authentication...');

  // Example: Login and store auth token
  // try {
  //   const response = await fetch(`${process.env.API_BASE_URL}/auth/login`, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({
  //       username: process.env.TEST_USERNAME,
  //       password: process.env.TEST_PASSWORD
  //     })
  //   });
  //
  //   if (!response.ok) {
  //     throw new Error(`Authentication failed: ${response.status}`);
  //   }
  //
  //   const { token } = await response.json();
  //   process.env.AUTH_TOKEN = token; // Store for tests to use
  // } catch (error) {
  //   throw new Error(`Authentication setup failed: ${error}`);
  // }

  // Placeholder for async authentication
  await new Promise((resolve) => setTimeout(resolve, 10));

  console.log('✓ Authentication setup completed');
}

/**
 * Setup database or seed test data
 */
async function setupDatabase(): Promise<void> {
  console.log('🗄️ Setting up database...');

  // Example: Run database migrations or seed data
  // try {
  //   // Connect to database
  //   // const db = await connectToDatabase();
  //
  //   // Run migrations
  //   // await db.migrate.latest();
  //
  //   // Seed test data
  //   // await db.seed.run();
  //
  //   // Close connection
  //   // await db.destroy();
  // } catch (error) {
  //   throw new Error(`Database setup failed: ${error}`);
  // }

  // Placeholder for async database setup
  await new Promise((resolve) => setTimeout(resolve, 10));

  console.log('✓ Database setup completed');
}

/**
 * Additional examples of what you might do in global setup:
 *
 * 1. Start test servers:
 *    await startTestServer();
 *
 * 2. Configure test data:
 *    await createTestUsers();
 *    await setupTestProducts();
 *
 * 3. Browser setup:
 *    await downloadBrowserExtensions();
 *    await setupBrowserProfiles();
 *
 * 4. External service mocking:
 *    await startMockPaymentService();
 *    await startMockEmailService();
 *
 * 5. File system setup:
 *    await createTestDirectories();
 *    await copyTestAssets();
 *
 * 6. Configuration validation:
 *    await validateTestConfig();
 *    await checkTestUrls();
 *
 * 7. Cache warming:
 *    await warmupCache();
 *    await preloadCriticalData();
 */
