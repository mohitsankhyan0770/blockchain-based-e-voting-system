// Database settings come from environment variables (see .env.example), never from this file.
require("dotenv").config();

module.exports = {
  type: "mysql",
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  username: process.env.DB_USER || "bbvs",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "bbvs",
  synchronize: false,
  logging: process.env.DB_LOGGING === "true",
  entities: ["src/entity/**/*.ts"],
  migrations: ["src/migration/**/*.ts"],
  cli: { migrationsDir: "src/migration" },
};
