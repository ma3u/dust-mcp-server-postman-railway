import { fileURLToPath } from 'url';
import path from 'path';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  testEnvironment: 'node',
  transform: {},
  transformIgnorePatterns: [
    '/node_modules/(?!(@modelcontextprotocol)/)'
  ],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^uuid$': path.resolve(__dirname, 'node_modules/uuid/dist/index.js'),
    '^node-fetch$': path.resolve(__dirname, 'node_modules/node-fetch/lib/index.js')
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
  testTimeout: 30000, // 30 seconds timeout for tests
  setupFilesAfterEnv: ['<rootDir>/test/setupTests.js'],
  testEnvironmentOptions: {
    url: 'http://localhost',
    customExportConditions: ['node', 'node-addons']
  },
  // Enable ES modules
  transform: {},
  // Add support for .js files with ES modules
  transformIgnorePatterns: [
    'node_modules/(?!(uuid|node-fetch|form-data-encoder|fetch-blob|formdata-polyfill|formdata-node|node-streams|@modelcontextprotocol)/'
  ]
};
