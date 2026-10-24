import { Router } from "express";
import { Config } from "../config";
import deleteController from "../controllers/users/delete";
import notVerifiedController from "../controllers/users/not-verified";
import verifyController from "../controllers/users/verify";
import { requireAdmin, requireAuth } from "../middlewares/auth";
import { asyncHandler } from "../utils/http";

export default (config: Config) => {
  const router = Router();
  router.use(requireAuth(config), requireAdmin); // every user-management route is admin-only

  router.get("/all", asyncHandler(notVerifiedController));
  router.post("/verify", asyncHandler(verifyController));
  router.delete("/delete/:id", asyncHandler(deleteController));
  return router;
};
