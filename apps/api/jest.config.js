module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: "src/.*\\.spec\\.ts$",
  transform: { "^.+\\.ts$": "ts-jest" },
  testEnvironment: "node",
  globalSetup: "<rootDir>/test/mysql-global-setup.cjs",
  globalTeardown: "<rootDir>/test/mysql-global-setup.cjs",
  coverageDirectory: "<rootDir>/coverage",
  collectCoverageFrom: ["src/**/*.service.ts"],
  coverageThreshold: { "./src/**/*.service.ts": { lines: 80, branches: 80 } },
};
