import { CandidateResult } from "../../chain";

/** { name, votes }[] -> { [name]: votes }, the shape the frontend charts expect. */
export const toVoteMap = (results: CandidateResult[]): Record<string, number> =>
  Object.fromEntries(results.map((r) => [r.name, r.votes]));
