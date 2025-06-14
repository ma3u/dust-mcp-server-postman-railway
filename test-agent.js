#!/usr/bin/env node

import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';
import readline from 'readline';
import WebSocket from 'ws';

const execAsync = promisify(exec);
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Load environment variables
dotenv.config();

// Configuration
const MCP_SERVER_URL = 'http://localhost:3001';
const WS_URL = `${MCP_SERVER_URL.replace('http', 'ws')}/sse`;

// Global state
let sessionId = null;
let conversationId = null;

// Helper function to send JSON-RPC requests
async function sendJsonRpcRequest(method, params = {}) {
  const response = await fetch(`${MCP_SERVER_URL}/messages?sessionId=${sessionId || ''}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Math.random().toString(36).substring(7),
      method,
      params
    })
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return response.json();
}

// List available agents
async function listAgents() {
  console.log('\nFetching available agents...');
  const result = await sendJsonRpcRequest('callTool', {
    name: 'list_agents',
    arguments: {}
  });
  
  if (result.error) {
    console.error('Error listing agents:', result.error);
    return [];
  }
  
  const agents = JSON.parse(result.result.content[0].text).agents;
  console.log('\nAvailable agents:');
  agents.forEach((agent, index) => {
    console.log(`${index + 1}. ${agent.name} (${agent.id})`);
    console.log(`   ${agent.description || 'No description'}`);
  });
  
  return agents;
}

// Start a new conversation
async function startConversation(agentId, message) {
  console.log(`\nStarting conversation with agent ${agentId}...`);
  
  const result = await sendJsonRpcRequest('callTool', {
    name: 'create_conversation',
    arguments: {
      agentId,
      message,
      sessionId: sessionId || undefined
    }
  });
  
  if (result.error) {
    console.error('Error starting conversation:', result.error);
    return null;
  }
  
  const data = JSON.parse(result.result.content[0].text);
  sessionId = data.sessionId;
  conversationId = data.conversationId;
  
  console.log(`Session ID: ${sessionId}`);
  console.log(`Conversation ID: ${conversationId}`);
  
  if (data.chunks) {
    console.log('\nAgent response:');
    data.chunks.forEach(chunk => {
      if (chunk.text) process.stdout.write(chunk.text);
    });
    console.log('\n');
  }
  
  return { sessionId, conversationId };
}

// Send a message in the current conversation
async function sendMessage(message) {
  if (!sessionId) {
    console.error('No active session. Please start a conversation first.');
    return;
  }
  
  console.log(`\nYou: ${message}`);
  console.log('Agent:');
  
  // For streaming responses
  const ws = new WebSocket(WS_URL);
  
  return new Promise((resolve, reject) => {
    ws.on('open', () => {
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id: Math.random().toString(36).substring(7),
        method: 'callTool',
        params: {
          name: 'send_message',
          arguments: {
            sessionId,
            message,
            stream: true
          }
        }
      }));
    });
    
    let fullResponse = '';
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        if (message.method === 'stream/chunk') {
          const chunk = JSON.parse(message.params.chunk.content[0].text);
          if (chunk.text) {
            process.stdout.write(chunk.text);
            fullResponse += chunk.text;
          }
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });
    
    ws.on('close', () => {
      console.log('\n');
      resolve(fullResponse);
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      reject(error);
    });
  });
}

// Interactive chat loop
async function chatLoop() {
  console.log('=== Dust Agent Chat ===');
  console.log('Type "exit" to quit\n');
  
  // List available agents
  const agents = await listAgents();
  if (agents.length === 0) {
    console.error('No agents found. Make sure your DUST_WORKSPACE_ID is set correctly.');
    process.exit(1);
  }
  
  // Select an agent
  const agentIndex = await new Promise((resolve) => {
    rl.question('Select an agent (number): ', (answer) => {
      resolve(parseInt(answer, 10) - 1);
    });
  });
  
  if (agentIndex < 0 || agentIndex >= agents.length) {
    console.error('Invalid agent selection');
    process.exit(1);
  }
  
  const agent = agents[agentIndex];
  console.log(`\nSelected agent: ${agent.name}`);
  
  // Start a conversation
  const firstMessage = await new Promise((resolve) => {
    rl.question('\nYour first message: ', resolve);
  });
  
  if (firstMessage.toLowerCase() === 'exit') {
    rl.close();
    return;
  }
  
  await startConversation(agent.id, firstMessage);
  
  // Chat loop
  while (true) {
    const message = await new Promise((resolve) => {
      rl.question('\nYou: ', resolve);
    });
    
    if (message.toLowerCase() === 'exit') {
      break;
    }
    
    await sendMessage(message);
  }
  
  rl.close();
}

// Start the chat
chatLoop().catch(console.error);

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nExiting...');
  process.exit(0);
});
