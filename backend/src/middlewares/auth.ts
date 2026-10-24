import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Config } from "../config";
import { User } from "../entity/User";
import { asyncHandler, sendError } from "../utils/http";

export interface AuthedUser {
  id: number;
  name: string;
  email: string;
  admin: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

/**
 * Requires `Authorization: Bearer <access token>`.
 * The user is re-read from the database on every request, so a deleted, unverified or
 * demoted account loses access immediately instead of when its token expires.
 */
export const requireAuth = (config: Config) =>
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return void sendError(res, 401, "not authenticated");

    let userId: number;
    try {
      const payload = jwt.verify(token, config.accessTokenSecret, { algorithms: ["HS256"] });
      userId = Number(typeof payload === "object" ? payload.sub : NaN);
    } catch {
      return void sendError(res, 401, "invalid or expired token");
    }
    if (!Number.isInteger(userId)) return void sendError(res, 401, "invalid token");

    const user = await User.findOne({ where: { id: userId } });
    if (!user || !user.verified) return void sendError(res, 401, "account not available");

    req.user = { id: user.id, name: user.name, email: user.email, admin: user.admin };
    next();
  });

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.admin) return void sendError(res, 403, "admin access required");
  next();
};
