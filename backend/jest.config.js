module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.test.json' }],
  },
  testEnvironment: 'node',
  collectCoverageFrom: ['**/*.(t|j)s', '!**/node_modules/**', '!instrument.ts', '!main.ts'],
  coverageDirectory: '../coverage',
  coverageReporters: ['text', 'lcov'],
};
