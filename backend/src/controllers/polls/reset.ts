import { Request, Response } from "express";
import { ElectionChain } from "../../chain";
import { HttpError } from "../../utils/http";

export default (chain: ElectionChain) => async (_req: Request, res: Response) => {
  if ((await chain.status()) !== "finished") throw new HttpError(400, "election not finished or already reset");
  await chain.reset();
  res.send("successful");
};
