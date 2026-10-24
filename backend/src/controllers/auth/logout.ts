import { Request, Response } from "express";
import { Config } from "../../config";
import { REFRESH_COOKIE, refreshCookieOptions } from "../../utils/tokens";

export default (config: Config) => (_req: Request, res: Response) => {
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(config), maxAge: undefined });
  res.status(204).end();
};
