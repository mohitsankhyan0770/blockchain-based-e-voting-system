import { Request, Response } from "express";
import { User } from "../../entity/User";

export default async (_req: Request, res: Response) => {
  const users = await User.find({
    select: ["id", "name", "citizenshipNumber", "email"],
    where: { verified: false },
  });
  res.send({ users });
};
