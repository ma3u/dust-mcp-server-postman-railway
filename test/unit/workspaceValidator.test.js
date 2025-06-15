import { jest } from '@jest/globals';
import { WorkspaceValidator } from '../../lib/validation/workspaceValidator.js';
import fetch from 'node-fetch';

// Mock node-fetch
jest.mock('node-fetch');

describe('WorkspaceValidator', () => {
  let validator;
  const mockApiKey = 'test-api-key';
  const mockWorkspaceId = 'test-workspace';
  const mockAgentId = 'test-agent';
  const mockApiUrl = 'https://dust.example.com/api/v1';

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Create a new validator instance for each test
    validator = new WorkspaceValidator({
      apiKey: mockApiKey,
      apiUrl: mockApiUrl
    });
  });

  describe('validateWorkspace', () => {
    it('should validate a workspace successfully', async () => {
      // Mock successful response
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: mockWorkspaceId, name: 'Test Workspace' })
      });

      const result = await validator.validateWorkspace(mockWorkspaceId);
      
      expect(result).toEqual({
        valid: true,
        exists: true
      });
      
      expect(fetch).toHaveBeenCalledWith(
        `${mockApiUrl}/w/${mockWorkspaceId}`,
        {
          headers: {
            'Authorization': `Bearer ${mockApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
    });

    it('should handle non-existent workspace', async () => {
      // Mock 404 response
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      const result = await validator.validateWorkspace('non-existent-workspace');
      
      expect(result).toEqual({
        valid: false,
        exists: false,
        error: 'Workspace not found'
      });
    });

    it('should handle API errors', async () => {
      // Mock error response
      const errorMessage = 'Internal server error';
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: errorMessage })
      });

      const result = await validator.validateWorkspace(mockWorkspaceId);
      
      expect(result).toEqual({
        valid: false,
        exists: false,
        error: `HTTP error! status: 500`
      });
    });
  });

  describe('validateAgent', () => {
    beforeEach(() => {
      // Mock successful workspace validation
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: mockWorkspaceId, name: 'Test Workspace' })
      });
    });

    it('should validate an agent successfully', async () => {
      // Mock successful agent validation
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: mockAgentId, name: 'Test Agent' })
      });

      const result = await validator.validateAgent(mockWorkspaceId, mockAgentId);
      
      expect(result).toEqual({
        valid: true,
        exists: true
      });
      
      expect(fetch).toHaveBeenLastCalledWith(
        `${mockApiUrl}/w/${mockWorkspaceId}/assistant/agent_configurations/${mockAgentId}`,
        {
          headers: {
            'Authorization': `Bearer ${mockApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
    });

    it('should handle non-existent agent', async () => {
      // Mock 404 response for agent
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      const result = await validator.validateAgent(mockWorkspaceId, 'non-existent-agent');
      
      expect(result).toEqual({
        valid: false,
        exists: false,
        error: 'Agent not found'
      });
    });

    it('should handle invalid workspace ID', async () => {
      // Mock 404 for workspace
      fetch.mockReset();
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      const result = await validator.validateAgent('invalid-workspace', mockAgentId);
      
      expect(result).toEqual({
        valid: false,
        exists: false,
        error: 'Workspace not found'
      });
    });
  });

  describe('caching', () => {
    it('should cache successful workspace validations', async () => {
      // First call - should make API request
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: mockWorkspaceId })
      });
      
      const firstResult = await validator.validateWorkspace(mockWorkspaceId);
      expect(fetch).toHaveBeenCalledTimes(1);
      
      // Second call - should use cache
      const secondResult = await validator.validateWorkspace(mockWorkspaceId);
      expect(fetch).toHaveBeenCalledTimes(1); // No additional API call
      
      expect(firstResult).toEqual(secondResult);
    });

    it('should cache successful agent validations', async () => {
      // Mock successful responses
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: mockWorkspaceId })
      }).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: mockAgentId })
      });
      
      // First call - should make API requests
      const firstResult = await validator.validateAgent(mockWorkspaceId, mockAgentId);
      expect(fetch).toHaveBeenCalledTimes(2);
      
      // Second call - should use cache
      const secondResult = await validator.validateAgent(mockWorkspaceId, mockAgentId);
      expect(fetch).toHaveBeenCalledTimes(2); // No additional API calls
      
      expect(firstResult).toEqual(secondResult);
    });
  });
});
