import { NextFunction, Request, RequestHandler, Response } from "express";

/** An error that is safe to show to the client. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

/** Express 4 does not catch rejected promises; this forwards them to the error middleware. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

/** Plain-text error body, which is what the existing frontend expects. */
export const sendError = (res: Response, status: number, message: string) =>
  res.status(status).type("text/plain").send(message);
