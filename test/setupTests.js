// Global test setup
import { TextEncoder, TextDecoder } from 'util';
import { jest } from '@jest/globals';
import { WebSocketServer } from 'ws';
import http from 'http';

// Add TextEncoder and TextDecoder to global scope for testing
// This is needed for some WebSocket and encoding/decoding operations
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock console.error to track errors in tests
const originalConsoleError = console.error;
const consoleErrorSpy = jest.fn((...args) => {
  originalConsoleError(...args);
});

// Mock fetch for HTTP requests
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({}),
  text: async () => ''
});

// WebSocket server for testing
let wss;
let httpServer;

// Mock WebSocket client
class MockWebSocketClient {
  constructor(url) {
    this.url = url;
    this.readyState = WebSocket.OPEN;
    this.listeners = {
      open: [],
      message: [],
      error: [],
      close: []
    };
    this.sentMessages = [];
    this.connected = false;
    
    // Simulate connection
    process.nextTick(() => {
      this.connected = true;
      this.trigger('open');
    });
  }

  send(data) {
    try {
      const message = typeof data === 'string' ? JSON.parse(data) : data;
      this.sentMessages.push(message);
      
      // Simulate server response
      if (message.method === 'startConversation') {
        this.simulateMessage({
          jsonrpc: '2.0',
          id: message.id,
          result: {
            conversationId: 'test-conversation-id',
            messages: [{ role: 'assistant', content: 'Test response' }]
          }
        });
      }
    } catch (err) {
      console.error('Error in WebSocket send:', err);
    }
  }

  close() {
    if (this.connected) {
      this.connected = false;
      this.readyState = WebSocket.CLOSED;
      this.trigger('close');
    }
  }

  // Helper to simulate server message
  simulateMessage(data) {
    const message = typeof data === 'string' ? data : JSON.stringify(data);
    this.listeners.message.forEach(handler => {
      try {
        handler({ data: message });
      } catch (err) {
        console.error('Error in message handler:', err);
      }
    });
  }

  // Trigger event
  trigger(event, ...args) {
    const handlers = this.listeners[event] || [];
    handlers.forEach(handler => {
      try {
        handler(...args);
      } catch (err) {
        console.error(`Error in ${event} handler:`, err);
      }
    });
  }

  // Event listener methods
  addEventListener(event, handler) {
    if (this.listeners[event]) {
      this.listeners[event].push(handler);
    }
  }

  removeEventListener(event, handler) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(h => h !== handler);
    }
  }

  // Alias for addEventListener for compatibility
  on(event, handler) {
    this.addEventListener(event, handler);
  }
}

// Setup test environment
beforeAll(async () => {
  // Mock WebSocket implementation
  global.WebSocket = MockWebSocketClient;
  
  // Start a mock HTTP server for WebSocket connections
  httpServer = http.createServer();
  wss = new WebSocketServer({ noServer: true });
  
  httpServer.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });
  
  // Start server on a random port
  await new Promise((resolve) => {
    httpServer.listen(0, 'localhost', resolve);
  });
  
  // Store the server URL for tests to use
  const address = httpServer.address();
  // Use '127.0.0.1' instead of '::1' (IPv6) to avoid URL parsing issues
  const host = address.address === '::' ? '127.0.0.1' : address.address;
  global.TEST_SERVER_URL = `http://${host}:${address.port}`;
  global.TEST_WS_URL = `ws://${host}:${address.port}/sse`;
});

// Cleanup after all tests
afterAll(async () => {
  // Close WebSocket server
  if (wss) {
    wss.close();
  }
  
  // Close HTTP server
  if (httpServer) {
    await new Promise((resolve) => httpServer.close(resolve));
  }
});

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  console.error = consoleErrorSpy;
  global.fetch.mockClear();
  
  // Reset any global test state
  if (global.testState) {
    global.testState = {};
  }
});

afterEach(() => {
  // Restore the original console.error
  console.error = originalConsoleError;
  
  // Clean up any remaining WebSocket connections
  if (wss) {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
    });
  }
});
