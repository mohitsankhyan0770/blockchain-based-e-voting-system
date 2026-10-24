import { Request, Response } from "express";
import { ElectionChain } from "../../chain";
import { HttpError } from "../../utils/http";
import { toVoteMap } from "./shared";

export default (chain: ElectionChain) => async (_req: Request, res: Response) => {
  if ((await chain.status()) !== "running") throw new HttpError(400, "election not started");
  res.send({ votes: toVoteMap(await chain.end()) });
};
