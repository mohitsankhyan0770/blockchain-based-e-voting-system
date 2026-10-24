import { Request, Response } from "express";
import { ElectionChain } from "../../chain";
import { toVoteMap } from "./shared";

/** Public: election title, description and the current tally. */
export default (chain: ElectionChain) => async (_req: Request, res: Response) => {
  const [{ name, description }, results] = await Promise.all([chain.details(), chain.results()]);
  res.send({ name, description, votes: toVoteMap(results) });
};
