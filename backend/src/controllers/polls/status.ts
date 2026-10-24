import { Request, Response } from "express";
import { ElectionChain } from "../../chain";

export default (chain: ElectionChain) => async (_req: Request, res: Response) => {
  res.send({ status: await chain.status() });
};
