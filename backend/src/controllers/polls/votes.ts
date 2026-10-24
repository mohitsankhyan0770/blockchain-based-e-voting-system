import { Request, Response } from "express";
import { ElectionChain } from "../../chain";
import { toVoteMap } from "./shared";

export default (chain: ElectionChain) => async (_req: Request, res: Response) => {
  res.send({ votes: toVoteMap(await chain.results()) });
};
