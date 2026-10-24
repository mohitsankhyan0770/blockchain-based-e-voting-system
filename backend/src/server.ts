import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { ElectionChain } from "./chain";
import { Config } from "./config";
import { errorHandler, notFound } from "./middlewares/error";
import authRouter from "./routers/auth";
import pollsRouter from "./routers/polls";
import usersRouter from "./routers/users";

/** Builds the Express app from explicit dependencies, so tests can inject a real in-process chain. */
export function createApp(config: Config, chain: ElectionChain) {
  const app = express();

  app.disable("x-powered-by");
  if (config.trustProxy) app.set("trust proxy", config.trustProxy);

  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json({ limit: "20kb" }));
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.send({ status: "ok" });
  });

  app.use("/auth", authRouter(config));
  app.use("/polls", pollsRouter(config, chain));
  app.use("/users", usersRouter(config));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
