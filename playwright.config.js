const { defineConfig } = require("@playwright/test");

const reporter = process.stdout.isTTY && !process.env.CI ? "list" : "dot";

module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 90000,
  expect: {
    timeout: 10000
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter
});
