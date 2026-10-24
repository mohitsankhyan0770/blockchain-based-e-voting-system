module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/test"],
  testMatch: ["**/*.test.ts"],
  testTimeout: 60000,
  globals: { "ts-jest": { diagnostics: { warnOnly: false } } },
};
