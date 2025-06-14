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
