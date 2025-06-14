import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Helper function to handle API errors
const handleApiError = (res, error) => {
  console.error('API Error:', error);
  return res.status(500).json({ 
    error: error.message || 'Internal server error' 
  });
};

// Helper to create form data for file uploads
const createFormData = (data, files = []) => {
  const formData = new FormData();
  
  // Add regular fields
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, value);
    }
  });
  
  // Add files
  files.forEach(file => {
    if (file && file.path) {
      formData.append('files', {
        uri: file.path,
        name: file.filename,
        type: file.mimetype
      });
    }
  });
  
  return formData;
};

/**
 * Creates and returns conversation routes
 * @param {Object} options - Options for the routes
 * @param {SessionManager} options.sessionManager - The session manager instance
 * @param {string} options.dustApiKey - API key for Dust API
 * @param {string} options.dustApiBaseUrl - Base URL for Dust API
 * @returns {express.Router} Configured router
 */
function createConversationRoutes({ sessionManager, dustApiKey, dustApiBaseUrl = 'https://dust.tt/api' }) {
  // Create a new conversation or continue an existing one
  router.post('/conversations', async (req, res) => {
    try {
      const { workspaceId, agentId, conversationId, message, sessionId, fileIds = [] } = req.body;

      // Validate required fields
      if (!workspaceId || !agentId || !message) {
        return res.status(400).json({ 
          error: 'Missing required fields: workspaceId, agentId, and message are required' 
        });
      }

      // Get or create session
      let session;
      if (sessionId) {
        session = sessionManager.getSession(sessionId);
        if (!session) {
          return res.status(401).json({ error: 'Invalid or expired session' });
        }
      } else {
        // Create a new session if no session ID provided
        session = sessionManager.createSession({
          workspaceId,
          agentId,
          metadata: {}
        });
      }

      // Update session activity
      sessionManager.updateSession(session.id, { 
        lastActivity: Date.now(),
        workspaceId,
        agentId
      });

      // Get files if any are referenced
      const files = [];
      if (fileIds && fileIds.length > 0) {
        for (const fileId of fileIds) {
          const file = session.files.find(f => f.id === fileId);
          if (file) {
            files.push({
              path: file.path,
              filename: file.filename,
              mimetype: file.mimetype
            });
          }
        }
      }

      // Determine conversation ID to use
      const targetConversationId = conversationId || session.conversationId;
      
      try {
        let response;
        
        if (!targetConversationId) {
          // Create new conversation
          const url = `${dustApiBaseUrl}/workspaces/${workspaceId}/conversations`;
          const formData = createFormData({
            agentId,
            message,
            fileIds: files.length > 0 ? fileIds : undefined
          }, files);
          
          const apiResponse = await fetch(url, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${dustApiKey}`,
              ...formData.getHeaders()
            },
            body: formData
          });
          
          if (!apiResponse.ok) {
            const error = await apiResponse.json();
            throw new Error(error.error || 'Failed to create conversation');
          }
          
          const data = await apiResponse.json();
          const newConversationId = data.conversation?.id || `conv-${uuidv4()}`;
          
          // Update session with new conversation ID
          sessionManager.updateSession(session.id, { 
            conversationId: newConversationId 
          });
          
          response = {
            conversationId: newConversationId,
            messages: [
              { role: 'user', content: message },
              { role: 'assistant', content: data.message?.content || 'Hello! How can I help you?' }
            ]
          };
        } else {
          // Continue existing conversation
          const url = `${dustApiBaseUrl}/workspaces/${workspaceId}/conversations/${targetConversationId}/messages`;
          const formData = createFormData({
            message,
            fileIds: files.length > 0 ? fileIds : undefined
          }, files);
          
          const apiResponse = await fetch(url, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${dustApiKey}`,
              ...formData.getHeaders()
            },
            body: formData
          });
          
          if (!apiResponse.ok) {
            const error = await apiResponse.json();
            throw new Error(error.error || 'Failed to send message');
          }
          
          const data = await apiResponse.json();
          
          response = {
            conversationId: targetConversationId,
            messages: [
              { role: 'user', content: message },
              { role: 'assistant', content: data.message?.content || 'I got your message!' }
            ]
          };
        }
        
        return res.status(200).json({
          ...response,
          sessionId: session.id
        });
        
      } catch (apiError) {
        console.error('Dust API Error:', apiError);
        return res.status(500).json({ 
          error: apiError.message || 'Failed to process conversation' 
        });
      }
      
    } catch (error) {
      return handleApiError(res, error);
    }
  });

  // Get conversation details
  router.get('/conversations/:conversationId', async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { workspaceId } = req.query;

      if (!workspaceId) {
        return res.status(400).json({ 
          error: 'workspaceId query parameter is required' 
        });
      }

      const url = `${dustApiBaseUrl}/workspaces/${workspaceId}/conversations/${conversationId}`;
      const apiResponse = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${dustApiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!apiResponse.ok) {
        const error = await apiResponse.json();
        return res.status(apiResponse.status).json({ 
          error: error.error || 'Failed to fetch conversation' 
        });
      }
      
      const data = await apiResponse.json();
      return res.status(200).json(data);
      
    } catch (error) {
      return handleApiError(res, error);
    }
  });

  return router;
}

export { createConversationRoutes };
