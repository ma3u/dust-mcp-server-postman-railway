const { fileURLToPath } = require('url'); // Though not strictly needed anymore if not used below
const path = require('path');

// __filename and __dirname are available directly in CommonJS when type: commonjs is set

module.exports = {
  testEnvironment: 'node',
  transform: {},
  transformIgnorePatterns: [
    '/node_modules/(?!(@modelcontextprotocol)/)'
  ],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testMatch: [
    '**/test/**/*.test.js',
    '**/test/**/*.spec.js'
  ],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  collectCoverageFrom: [
    'lib/**/*.js',
    '!**/node_modules/**',
    '!**/test/**',
    '!**/coverage/**',
    '!**/babel.config.js',
    '!**/jest.config.js'
  ],
  verbose: true,
  testTimeout: 30000,
  fakeTimers: { "enableGlobally": true }, // 30 seconds timeout for tests
  setupFilesAfterEnv: ['<rootDir>/test/setupTests.js'],
  testEnvironmentOptions: {
    url: 'http://localhost',
    customExportConditions: ['node', 'node-addons']
  },
  // Enable ES modules
  transform: {},
  // Add support for .js files with ES modules
  transformIgnorePatterns: [
    'node_modules/(?!(uuid|node-fetch|form-data-encoder|fetch-blob|formdata-polyfill|formdata-node|node-streams|@modelcontextprotocol))/'
  ]
};
