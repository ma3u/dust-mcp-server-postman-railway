// lib/agentManager.js
'use strict';

/**
 * @fileoverview Manages agent configurations, including fetching and caching.
 */

const fs = require('fs').promises;
const path = require('path');

const AGENTS_CONFIG_PATH = path.join(__dirname, '..', 'agents.json'); // Assumes agents.json is in the root
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let agentCache = {
  data: null,
  timestamp: 0,
};

/**
 * Fetches agent configurations.
 * Reads from agents.json and caches the result.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of agent configurations.
 * @throws {Error} If fetching or parsing fails.
 */
async function getAgentConfigurations() {
  const now = Date.now();

  if (agentCache.data && (now - agentCache.timestamp < CACHE_TTL_MS)) {
    console.error('[DEBUG] AgentManager: Returning cached agent configurations.');
    return agentCache.data;
  }

  try {
    console.error(`[DEBUG] AgentManager: Fetching agent configurations from ${AGENTS_CONFIG_PATH}`);
    const fileContent = await fs.readFile(AGENTS_CONFIG_PATH, 'utf-8');
    const agents = JSON.parse(fileContent);

    agentCache = {
      data: agents,
      timestamp: now,
    };
    console.error('[DEBUG] AgentManager: Agent configurations fetched and cached.');
    return agents;
  } catch (error) {
    console.error('[ERROR] AgentManager: Failed to fetch or parse agent configurations:', error);
    // In case of error, clear cache to force re-fetch next time, or return stale if acceptable
    agentCache.data = null; 
    agentCache.timestamp = 0;
    throw new Error(`Failed to load agent configurations: ${error.message}`);
  }
}

/**
 * Clears the agent configuration cache.
 */
function clearAgentCache() {
  agentCache = {
    data: null,
    timestamp: 0,
  };
  console.error('[INFO] AgentManager: Agent configuration cache cleared.');
}

module.exports = {
  getAgentConfigurations,
  clearAgentCache,
};
