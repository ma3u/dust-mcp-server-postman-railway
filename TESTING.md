# Testing the MCP Server

This document provides information on how to run and maintain tests for the MCP Server.

## Test Structure

The test suite is organized into the following directories:

- `test/unit/`: Unit tests for individual components
- `test/integration/`: Integration tests that test the interaction between components
- `test/helpers/`: Test utilities and helpers

## Running Tests

### Prerequisites

- Node.js 16.0.0 or higher
- npm 7.0.0 or higher

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

### Running Tests

- Run all tests:
  ```bash
  npm test
  ```

- Run tests in watch mode:
  ```bash
  npm run test:watch
  ```

- Run tests with coverage:
  ```bash
  npm run test:coverage
  ```

- Run specific test files:
  ```bash
  NODE_OPTIONS=--experimental-vm-modules npx jest test/path/to/test-file.test.js
  ```

## Test Helper

The `MCPTestHelper` class provides utilities for testing the MCP server:

- `startServer()`: Starts the MCP server
- `stopServer()`: Stops the MCP server
- `connectWebSocket()`: Connects to the WebSocket server
- `sendJsonRpc(method, params)`: Sends a JSON-RPC message
- `waitForMessage(method, timeout)`: Waits for a specific message type
- `testAgentConversation(options)`: Helper for testing agent conversations

## Writing Tests

### Unit Tests

Unit tests should be placed in the `test/unit/` directory and follow the naming pattern `*.test.js`.

Example unit test:

```javascript
import { MyComponent } from '../../lib/myComponent.js';

describe('MyComponent', () => {
  let component;
  
  beforeEach(() => {
    component = new MyComponent();
  });
  
  test('should do something', () => {
    // Test implementation
  });
});
```

### Integration Tests

Integration tests should be placed in the `test/integration/` directory and follow the naming pattern `*.test.js`.

Example integration test:

```javascript
import { MCPTestHelper } from '../helpers/mcpTestHelper.js';

describe('Agent Conversation Flow', () => {
  let testHelper;
  
  beforeAll(async () => {
    testHelper = new MCPTestHelper();
    await testHelper.startServer();
    await testHelper.connectWebSocket();
  });
  
  afterAll(async () => {
    await testHelper.stopServer();
  });
  
  test('should start a conversation', async () => {
    const result = await testHelper.testAgentConversation({
      workspaceId: 'test',
      agentId: 'test-agent',
      message: 'Hello'
    });
    
    expect(result).toHaveProperty('conversationId');
    expect(result).toHaveProperty('response.messages');
  });
});
```

## Best Practices

1. **Isolation**: Each test should be independent and not rely on the state from other tests.
2. **Cleanup**: Always clean up resources in `afterEach` or `afterAll` hooks.
3. **Mocks**: Use Jest's mocking capabilities to isolate the code under test.
4. **Descriptive Names**: Use descriptive test names that explain what is being tested.
5. **Assertions**: Make specific assertions about the expected behavior.

## AI-Assisted Development Best Practices

When working with AI-assisted development, follow these guidelines to ensure effective testing and debugging:

### 1. Run Tests with Maximum Verbosity

Always run tests with maximum verbosity to help AI understand test failures and provide better assistance:

```bash
# Run tests with maximum verbosity
npm test -- --verbose

# For watch mode with verbose output
npm run test:watch -- --verbose

# For specific test files with detailed output
NODE_OPTIONS=--experimental-vm-modules npx jest --verbose test/path/to/test-file.test.js
```

### 2. Add Strategic Logging

Enhance test debugging by adding informative log statements:

```javascript
test('should handle complex interaction', async () => {
  // Log important state before test
  console.error('Starting test with initial state:', {
    userId: testUser.id,
    sessionId: testSession.id
  });
  
  try {
    const result = await complexOperation();
    
    // Log intermediate results
    console.error('Operation result:', JSON.stringify(result, null, 2));
    
    expect(result).toMatchObject({
      status: 'success',
      // ... other assertions
    });
  } catch (error) {
    // Log detailed error information
    console.error('Test failed with error:', {
      message: error.message,
      stack: error.stack,
      // Add relevant context
    });
    throw error; // Re-throw to fail the test
  }
});
```

### 3. Compare Similar Tests

When debugging, compare similar tests to identify patterns and differences:

1. **Create Test Matrices**: Document test cases in a matrix to identify coverage gaps
2. **Use Test Suites**: Group related tests to compare behavior across scenarios
3. **Document Edge Cases**: Keep a running list of edge cases and their test coverage

### 4. Work in Small Units

For better focus and more effective AI assistance:

1. **Test One Thing at a Time**: Each test should verify a single behavior
2. **Use `test.only` for Focused Debugging**:

   ```javascript
   // Only run this test during debugging
   test.only('specific behavior', () => {
     // Test implementation
   });
   ```

3. **Break Down Complex Tests**: Split large tests into smaller, focused tests

### 5. AI Prompting Best Practices

When working with AI to write or debug tests:

1. **Provide Context**: Share the test file and related implementation code
2. **Be Specific**: Clearly describe the expected behavior and any error messages
3. **Ask for Explanations**: Request explanations for test failures and suggested fixes
4. **Request Examples**: Ask for similar test patterns from the codebase

### 6. Test Data Management

1. **Use Factories**: Create test data factories for consistent test data
2. **Clean Up**: Always clean up test data after tests run
3. **Use Faker**: For realistic test data, use libraries like `@faker-js/faker`

### 7. Performance Considerations

1. **Mock External Services**: Use mocks for external API calls
2. **Use `--detectOpenHandles`**: Detect and clean up open handles:

   ```bash
   NODE_OPTIONS=--experimental-vm-modules npx jest --detectOpenHandles
   ```

3. **Profile Tests**: Identify slow tests with `--runInBand --logHeapUsage`

### 8. Debugging Complex Tests

1. **Use `--runInBand`**: Run tests sequentially for easier debugging
2. **Debug with Chrome DevTools**:

   ```bash
   node --inspect-brk -r @babel/register ./node_modules/.bin/jest --runInBand --watch
   ```

3. **Add Timeouts**: For async tests, ensure proper timeouts are set

### 9. Documentation

1. **Document Test Patterns**: Keep a TEST_PATTERNS.md file with common test scenarios
2. **Comment Complex Logic**: Explain why certain test cases exist
3. **Update Documentation**: Keep test documentation in sync with implementation changes

## Debugging Tests

To debug tests, you can use Node.js' built-in debugger:

```bash
node --inspect-brk -r @babel/register ./node_modules/.bin/jest --runInBand
```

Then open Chrome DevTools and navigate to `chrome://inspect` to attach to the Node.js process.

## Continuous Integration

The test suite is configured to run in CI environments. The following environment variables may need to be set in your CI environment:

- `NODE_ENV=test`
- `PORT=3001` (or another available port for testing)
