const http = require("node:http");
const { createApp } = require("./app");

const app = createApp();
const server = http.createServer(app);

server.listen(app.locals.context.config.port, () => {
  const { baseUrl, paymentProvider, dbPath, env } = app.locals.context.config;
  console.log(`BOLHA entitlement server listening on ${baseUrl}`);
  console.log(`env: ${env}`);
  console.log(`payment provider: ${paymentProvider}`);
  console.log(`db: ${dbPath}`);
});
