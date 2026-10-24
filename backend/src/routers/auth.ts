import { Router } from "express";
import rateLimit from "express-rate-limit";
import checkController from "../controllers/auth/check";
import loginController from "../controllers/auth/login";
import logoutController from "../controllers/auth/logout";
import signupController from "../controllers/auth/signup";
import { Config } from "../config";
import { asyncHandler } from "../utils/http";

export default (config: Config) => {
  const router = Router();

  // Throttles guessing: only failed attempts count, so normal logins are never blocked.
  const attempts = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.authRateLimit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: "too many attempts, try again later",
  });

  router.post("/login", attempts, asyncHandler(loginController(config)));
  router.post("/signup", attempts, asyncHandler(signupController));
  router.post("/check", asyncHandler(checkController(config)));
  router.post("/logout", logoutController(config));
  return router;
};
