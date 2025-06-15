# MCP Server Development Guidelines

This document outlines the development guidelines and best practices for the MCP Server implementation.

## Logging Guidelines

### 1. Never Log to STDOUT

**Rule**: Never use `console.log()` or `process.stdout.write()` for logging in the MCP server.

**Why**: The MCP protocol communicates over STDOUT using JSON-RPC 2.0. Any extraneous output to STDOUT will break the protocol.

### 2. Use STDERR for Development Logging

**Rule**: Use `console.error()` for development and debugging logs.

```javascript
// Good - writes to stderr
console.error('[DEBUG] Server starting...');

// Bad - writes to stdout
console.log('Server starting...');
```

### 3. Client-Visible Logs with `sendLoggingMessage()`

**Rule**: For logs that should be visible to the client, implement and use the `sendLoggingMessage()` function.

```javascript
/**
 * Sends a structured log message to the client
 * @param {string} level - Log level (error, warn, info, debug)
 * @param {string} message - Log message
 * @param {Object} [data] - Additional data to include in the log
 */
function sendLoggingMessage(level, message, data = {}) {
  const logMessage = {
    jsonrpc: '2.0',
    method: 'log',
    params: {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...data
    }
  };
  
  // Send the log message to the client
  process.stdout.write(JSON.stringify(logMessage) + '\n');
}

// Example usage
sendLoggingMessage('info', 'Server started', { port: 3000 });
```

### 4. Log Levels

Use the following log levels consistently:

- **error**: Critical errors that prevent normal operation
- **warn**: Warnings about potential issues
- **info**: General operational messages
- **debug**: Detailed debugging information

### 5. Structured Logging

Always include relevant context in your logs:

```javascript
// Good - includes context
console.error(`[ERROR] Failed to process request: ${error.message}`, {
  requestId,
  error: error.stack,
  timestamp: new Date().toISOString()
});

// Bad - lacks context
console.error('Request failed');
```

## Error Handling

### 1. Always Handle Errors

**Rule**: Never let errors propagate to the top level without handling them.

```javascript
try {
  // Code that might throw
} catch (error) {
  console.error('[ERROR] Operation failed', { error: error.message, stack: error.stack });
  // Handle or rethrow with context
  throw new Error(`Failed to perform operation: ${error.message}`);
}
```

### 2. Use Custom Error Classes

Create specific error types for better error handling:

```javascript
class McpError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'McpError';
    this.code = code;
    this.details = details;
  }
}

// Usage
throw new McpError('Invalid request', 'INVALID_REQUEST', { field: 'username' });
```

## Code Style

1. **Use ES Modules**: Always use `import/export` syntax instead of `require/module.exports`.
2. **Type Safety**: Use JSDoc for type annotations.
3. **Error Handling**: Always handle errors appropriately.
4. **Testing**: Write tests for all new functionality.

## Environment Variables

Document all required environment variables in `.env.example` and ensure they're properly validated on startup.

## Performance

1. **Avoid Blocking Operations**: Use async/await for I/O operations.
2. **Memory Management**: Be mindful of memory usage, especially with large payloads.
3. **Connection Pooling**: Reuse connections when possible.

## Security

1. **Input Validation**: Always validate and sanitize user input.
2. **Secrets**: Never log sensitive information.
3. **Dependencies**: Keep dependencies updated and audit regularly.

## Testing

1. Write unit tests for all new functionality.
2. Include integration tests for critical paths.
3. Test error conditions and edge cases.

## Documentation

1. Document all public APIs with JSDoc.
2. Update README.md with setup and usage instructions.
3. Document any configuration options and their defaults.
