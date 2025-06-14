import { MCPTestHelper } from '../helpers/mcpTestHelper.js';
import { jest } from '@jest/globals';

// Increase timeout for integration tests
jest.setTimeout(10000);

describe('Agent Conversation Flow', () => {
  let testHelper;
  
  beforeAll(async () => {
    testHelper = new MCPTestHelper({
      serverUrl: global.TEST_SERVER_URL,
      wsUrl: global.TEST_WS_URL
    });
    
    // Initialize the test helper
    try {
      await testHelper.initialize();
    } catch (error) {
      console.error('Failed to initialize test helper:', error);
      throw error;
    }
  });

  afterAll(async () => {
    if (testHelper && typeof testHelper.cleanup === 'function') {
      try {
        await testHelper.cleanup();
      } catch (error) {
        console.error('Error during test cleanup:', error);
      }
    }
  });

  afterEach(() => {
    if (testHelper && typeof testHelper.clearMessageQueue === 'function') {
      testHelper.clearMessageQueue();
    }
  });

  test('should start a new conversation with an agent', async () => {
    // Test data
    const testData = {
      workspaceId: 'test-workspace',
      agentId: 'test-agent',
      message: 'Hello, agent!'
    };

    // Start a conversation
    const { conversationId, response } = await testHelper.testAgentConversation(testData);
    
    // Verify the response structure
    expect(response).toBeDefined();
    expect(conversationId).toBe('test-conversation-id');
    expect(response).toHaveProperty('messages');
    expect(Array.isArray(response.messages)).toBe(true);
    expect(response.messages.length).toBe(1);
    expect(response.messages[0]).toEqual({
      role: 'assistant',
      content: 'Test response'
    });
  });

  test('should handle tool calls in conversation', async () => {
    // Start a conversation that will trigger a tool call
    const { conversationId } = await testHelper.testAgentConversation({
      workspaceId: 'test-workspace',
      agentId: 'test-agent',
      message: 'Call a test tool'
    });

    // Simulate tool call request from the agent
    const toolCallMessage = {
      jsonrpc: '2.0',
      id: 'test-tool-call',
      method: 'callTool',
      params: {
        conversationId,
        toolName: 'test_tool',
        parameters: { param1: 'value1' }
      }
    };

    // Mock the tool response
    testHelper.mockResponse('test-tool-call', {
      jsonrpc: '2.0',
      id: 'test-tool-call',
      result: {
        content: 'Tool execution result',
        type: 'text'
      }
    });

    // Send the tool call request
    const response = await testHelper.sendJsonRpc(toolCallMessage.method, toolCallMessage.params);
    
    // Verify the tool call response
    expect(response).toHaveProperty('result');
    expect(response.result).toHaveProperty('content', 'Tool execution result');
  });

  test('should handle conversation errors gracefully', async () => {
    // Mock an error response for non-existent agent
    testHelper.mockError('agent-error', {
      code: -32603,
      message: 'Agent not found',
      data: 'The specified agent does not exist'
    });

    // Test with invalid agent ID
    await expect(
      testHelper.testAgentConversation({
        workspaceId: 'test-workspace',
        agentId: 'non-existent-agent',
        message: 'This should fail'
      })
    ).rejects.toThrow('Agent not found');
  });

  test('should maintain conversation state', async () => {
    // Start first conversation
    const firstMessage = 'First message';
    const { conversationId } = await testHelper.testAgentConversation({
      workspaceId: 'test-workspace',
      agentId: 'test-agent',
      message: firstMessage
    });

    // Mock the follow-up response
    testHelper.mockResponse('follow-up-message', {
      jsonrpc: '2.0',
      id: 'follow-up-message',
      result: {
        conversationId,
        messages: [
          { role: 'user', content: 'Follow-up message' },
          { role: 'assistant', content: 'Response to follow-up' }
        ]
      }
    });

    // Send follow-up message in the same conversation
    const response = await testHelper.sendJsonRpc('sendMessage', {
      conversationId,
      message: 'Follow-up message'
    });

    // Verify the response
    expect(response).toHaveProperty('result.conversationId', conversationId);
    expect(response.result).toHaveProperty('messages');
    expect(Array.isArray(response.result.messages)).toBe(true);
    expect(response.result.messages.length).toBe(2);
    expect(response.result.messages[1]).toEqual({
      role: 'assistant',
      content: 'Response to follow-up'
    });
  });
});
