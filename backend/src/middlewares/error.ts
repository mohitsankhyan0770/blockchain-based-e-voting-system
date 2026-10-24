import { ErrorRequestHandler, RequestHandler } from "express";
import { ChainError } from "../chain";
import { HttpError, sendError } from "../utils/http";

export const notFound: RequestHandler = (_req, res) => {
  sendError(res, 404, "not found");
};

/**
 * Last line of defence. Known errors map to a clean status; anything else is logged
 * server-side and answered with a generic 500, so internals (SQL, stack traces,
 * chain errors) never reach the client.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (res.headersSent) return;
  if (err instanceof HttpError) return void sendError(res, err.status, err.message);
  if (err instanceof ChainError && err.code === "UNAVAILABLE")
    return void sendError(res, 503, "the blockchain node is not reachable");
  if (err?.type === "entity.parse.failed") return void sendError(res, 400, "invalid JSON");
  if (err?.type === "entity.too.large") return void sendError(res, 413, "request too large");

  console.error(err);
  sendError(res, 500, "server error");
};
