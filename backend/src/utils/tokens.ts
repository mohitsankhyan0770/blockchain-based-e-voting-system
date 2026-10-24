import { CookieOptions } from "express";
import jwt from "jsonwebtoken";
import { Config } from "../config";
import { User } from "../entity/User";

export const REFRESH_COOKIE = "refreshToken";

export function issueTokens(config: Config, user: User) {
  const claims = { sub: String(user.id) };
  const accessToken = jwt.sign(claims, config.accessTokenSecret, {
    algorithm: "HS256",
    expiresIn: config.accessTokenTtl,
  } as jwt.SignOptions);
  const refreshToken = jwt.sign(claims, config.refreshTokenSecret, {
    algorithm: "HS256",
    expiresIn: `${config.refreshTokenTtlDays}d`,
  } as jwt.SignOptions);
  return { accessToken, refreshToken };
}

/**
 * The refresh token lives in an httpOnly cookie, so page scripts (and any XSS) cannot read it.
 * `path: /auth` means the browser only sends it to the auth endpoints, and SameSite=Lax stops
 * other sites from triggering the token refresh.
 */
export const refreshCookieOptions = (config: Config): CookieOptions => ({
  httpOnly: true,
  secure: config.isProduction,
  sameSite: "lax",
  path: "/auth",
  maxAge: config.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
});
