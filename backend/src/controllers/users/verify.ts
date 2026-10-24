import { Request, Response } from "express";
import * as yup from "yup";
import { User } from "../../entity/User";
import { HttpError } from "../../utils/http";
import { toPublicUser } from "../../utils/user";
import { validate } from "../../utils/validate";

const schema = yup.object({ userId: yup.number().integer().positive().required() });

export default async (req: Request, res: Response) => {
  const { userId } = await validate(schema, req.body);

  const user = await User.findOne({ where: { id: userId } });
  if (!user) throw new HttpError(404, "no such user");

  user.verified = true;
  await user.save();
  res.send({ user: toPublicUser(user) });
};
