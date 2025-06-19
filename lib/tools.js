const { toolPaths } = require("../tools/paths.js");

/**
 * Discovers and loads available tools from the tools directory
 * @returns {Array} Array of tool objects
 */
function discoverTools() {
  const tools = toolPaths.map((filePath) => {
    const relativePath = `../tools/${filePath}`;
    const toolModule = require(relativePath);
    return {
      name: toolModule.apiTool.definition.function.name,
      description: toolModule.apiTool.definition.function.description,
      execute: toolModule.apiTool.function,
      path: filePath
    };
  });
  return tools;
}

module.exports = { discoverTools };
