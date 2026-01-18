import express from "express";
import { register, login, logout } from "../controllers/authController.js";
import upload from "../middleware/uploadMiddlewae.js";

const router = express.Router();

router.post("/register", upload.single("profileImage"), register);
router.post("/login", login);
router.post("/logout", logout);

export default router;
