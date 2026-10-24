import { Request, Response } from "express";
import * as yup from "yup";
import { ElectionChain } from "../../chain";
import { HttpError } from "../../utils/http";
import { validate } from "../../utils/validate";

const schema = yup.object({
  name: yup.string().trim().min(3).max(200).required(),
  description: yup.string().trim().min(10).max(2000).required(),
  candidates: yup
    .array(
      yup.object({
        name: yup.string().trim().min(3).max(100).required(),
        info: yup.string().trim().min(10).max(500).required(),
      })
    )
    .min(2, "at least 2 candidates are required")
    .max(50)
    .required(),
});

export default (chain: ElectionChain) => async (req: Request, res: Response) => {
  const data = await validate(schema, req.body);

  const unique = new Set(data.candidates.map((c) => c.name.toLowerCase()));
  if (unique.size !== data.candidates.length) throw new HttpError(400, "candidate names must be unique");

  if ((await chain.status()) !== "not-started") throw new HttpError(400, "election already started or not reset");

  await chain.start({
    name: data.name,
    description: data.description,
    candidates: data.candidates as { name: string; info: string }[],
  });
  res.status(201).send(data);
};
