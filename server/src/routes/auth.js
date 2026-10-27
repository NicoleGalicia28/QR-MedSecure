import { Router } from "express";
import { body } from "express-validator";
import { login, refresh, me, register, requestStatus } from "../controllers/authController.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.post("/login", [body("email").isEmail(), body("password").notEmpty()], login);
// Public: submits an account request for admin approval.
router.post(
  "/register",
  [body("email").isEmail(), body("name").notEmpty(), body("password").notEmpty()],
  register,
);
// Public: an applicant checks the status of their own account request.
router.get("/requests/:id", requestStatus);
router.post("/refresh", refresh);
router.get("/me", authMiddleware, me);
export default router;
