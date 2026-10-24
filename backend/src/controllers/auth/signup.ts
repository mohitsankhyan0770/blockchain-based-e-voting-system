import bcrypt from "bcryptjs";
import { Request, Response } from "express";
import * as yup from "yup";
import { User } from "../../entity/User";
import { HttpError } from "../../utils/http";
import { toPublicUser } from "../../utils/user";
import { validate } from "../../utils/validate";

const schema = yup.object({
  name: yup.string().trim().min(3).max(100).required(),
  email: yup.string().trim().lowercase().email().max(180).required(),
  password: yup.string().min(8, "password must be at least 8 characters").max(72).required(),
  citizenshipNumber: yup.string().trim().min(4).max(100).required(),
});

export default async (req: Request, res: Response) => {
  const data = await validate(schema, req.body);

  const existing = await User.findOne({ where: [{ email: data.email }, { citizenshipNumber: data.citizenshipNumber }] });
  if (existing) throw new HttpError(409, "an account with this email or citizenship number already exists");

  const user = new User();
  user.admin = false; // admins are only ever created with `npm run seed:admin`
  user.verified = false; // an admin must verify the person before they can log in or vote
  user.name = data.name;
  user.email = data.email;
  user.citizenshipNumber = data.citizenshipNumber;
  user.password = await bcrypt.hash(data.password, 10);

  try {
    await user.save();
  } catch (error) {
    // two signups racing past the check above; the database unique index still catches it
    if (/duplicate|unique/i.test(String((error as Error).message)))
      throw new HttpError(409, "an account with this email or citizenship number already exists");
    throw error;
  }

  res.status(201).send({ user: toPublicUser(user) });
};
