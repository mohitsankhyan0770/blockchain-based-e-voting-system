import { Request, Response } from "express";
import { User } from "../../entity/User";
import { HttpError } from "../../utils/http";

export default async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "invalid id");
  if (id === req.user!.id) throw new HttpError(400, "you cannot delete your own account");

  const user = await User.findOne({ where: { id } });
  if (!user) throw new HttpError(404, "no such user");
  if (user.admin) throw new HttpError(400, "admin accounts cannot be deleted here");

  await user.remove();
  res.send({ userId: id });
};
