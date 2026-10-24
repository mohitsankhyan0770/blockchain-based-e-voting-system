import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Config } from "../../config";
import { User } from "../../entity/User";
import { HttpError } from "../../utils/http";
import { issueTokens, REFRESH_COOKIE, refreshCookieOptions } from "../../utils/tokens";
import { toPublicUser } from "../../utils/user";

/** Exchanges the refresh cookie for a new access token (and rotates the cookie). */
export default (config: Config) => async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw new HttpError(401, "not authenticated");

  const reject = (message: string) => {
    res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(config), maxAge: undefined });
    return new HttpError(401, message);
  };

  let userId: number;
  try {
    const payload = jwt.verify(token, config.refreshTokenSecret, { algorithms: ["HS256"] });
    userId = Number(typeof payload === "object" ? payload.sub : NaN);
  } catch {
    throw reject("session expired");
  }

  const user = Number.isInteger(userId) ? await User.findOne({ where: { id: userId } }) : undefined;
  if (!user || !user.verified) throw reject("account not available");

  const tokens = issueTokens(config, user);
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions(config));
  res.send({ user: toPublicUser(user), accessToken: tokens.accessToken });
};
