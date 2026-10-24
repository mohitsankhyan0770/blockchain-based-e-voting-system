import { Request, Response } from "express";
import * as yup from "yup";
import { ChainError, ElectionChain } from "../../chain";
import { HttpError } from "../../utils/http";
import { validate } from "../../utils/validate";

// Who is voting always comes from the verified login token (req.user), never from the request body.
// The original API trusted an `id` and `name` sent by the browser, so anyone could vote as anyone.
const schema = yup.object({ candidate: yup.string().trim().min(1).max(100).required() });

export const checkVoteability = (chain: ElectionChain) => async (req: Request, res: Response) => {
  if ((await chain.status()) !== "running") throw new HttpError(400, "election not running");
  res.send((await chain.hasVoted(req.user!.id)) ? "already-voted" : "not-voted");
};

export default (chain: ElectionChain) => async (req: Request, res: Response) => {
  const { candidate } = await validate(schema, req.body);

  try {
    await chain.vote(req.user!.id, candidate);
  } catch (error) {
    if (error instanceof ChainError) {
      if (error.code === "ALREADY_VOTED") throw new HttpError(409, "already voted");
      if (error.code === "INVALID_CANDIDATE") throw new HttpError(400, "no such candidate");
      if (error.code === "NOT_RUNNING") throw new HttpError(400, "election not running");
    }
    throw error;
  }
  res.send("successful");
};
