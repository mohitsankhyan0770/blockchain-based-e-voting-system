import "reflect-metadata";
import "dotenv/config";
import { createConnection } from "typeorm";
import { createChainFromConfig } from "./chain";
import { ConfigError, loadConfig, SetupError } from "./config";
import { createApp } from "./server";

async function main() {
  const config = loadConfig();
  const chain = createChainFromConfig(config);

  await createConnection(); // reads ormconfig.js
  createApp(config, chain).listen(config.port, () => console.log(`listening on port ${config.port} (${config.nodeEnv})`));
}

main().catch((error) => {
  // setup mistakes already explain how to fix themselves; real bugs keep their stack trace
  console.error(error instanceof ConfigError || error instanceof SetupError ? error.message : error);
  process.exit(1);
});
