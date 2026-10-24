import { Router } from "express";
import rateLimit from "express-rate-limit";
import { ElectionChain } from "../chain";
import { Config } from "../config";
import endController from "../controllers/polls/end";
import fetchController from "../controllers/polls/fetch";
import resetController from "../controllers/polls/reset";
import startController from "../controllers/polls/start";
import statusController from "../controllers/polls/status";
import voteController, { checkVoteability } from "../controllers/polls/vote";
import votesController from "../controllers/polls/votes";
import { requireAdmin, requireAuth } from "../middlewares/auth";
import { asyncHandler } from "../utils/http";

export default (config: Config, chain: ElectionChain) => {
  const router = Router();
  const auth = requireAuth(config);
  const voteLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: config.voteRateLimit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: "too many requests, slow down",
  });

  // public: anyone can watch an election
  router.get("/", asyncHandler(fetchController(chain)));
  router.get("/status", asyncHandler(statusController(chain)));
  router.get("/votes", asyncHandler(votesController(chain)));

  // voters: must be logged in and verified
  router.post("/check-voteability", auth, asyncHandler(checkVoteability(chain)));
  router.post("/vote", voteLimiter, auth, asyncHandler(voteController(chain)));

  // admins only
  router.post("/start", auth, requireAdmin, asyncHandler(startController(chain)));
  router.post("/end", auth, requireAdmin, asyncHandler(endController(chain)));
  router.post("/reset", auth, requireAdmin, asyncHandler(resetController(chain)));
  return router;
};
