export default {
  testEnvironment: 'node',
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
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
  testTimeout: 30000, // 30 seconds timeout for tests
  setupFilesAfterEnv: ['<rootDir>/test/setupTests.js'],
  testEnvironmentOptions: {
    url: 'http://localhost:3001'
  }
};
