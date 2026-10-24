import bcrypt from "bcryptjs";
import { Request, Response } from "express";
import * as yup from "yup";
import { Config } from "../../config";
import { User } from "../../entity/User";
import { HttpError } from "../../utils/http";
import { issueTokens, REFRESH_COOKIE, refreshCookieOptions } from "../../utils/tokens";
import { toPublicUser } from "../../utils/user";
import { validate } from "../../utils/validate";

const schema = yup.object({
  email: yup.string().trim().lowercase().email().required(),
  password: yup.string().min(1).max(72).required(),
});

// Compared against when the email is unknown, so "no such user" takes as long as "wrong password".
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export default (config: Config) => async (req: Request, res: Response) => {
  const { email, password } = await validate(schema, req.body);

  const user = await User.findOne({ where: { email } });
  const passwordOk = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);

  // Same message for "unknown email" and "wrong password": the API does not reveal which emails exist.
  if (!user || !passwordOk) throw new HttpError(401, "invalid email or password");
  if (!user.verified) throw new HttpError(403, "your account is waiting for admin verification");

  const { accessToken, refreshToken } = issueTokens(config, user);
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions(config));
  res.send({ user: toPublicUser(user), accessToken });
};
