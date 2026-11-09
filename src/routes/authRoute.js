import express from "express";
import { 
    register, 
    login, 
    logout, 
    getMe, 
    forgotPassword, 
    resetPassword, 
    sendEmailVerification, 
    verifyEmail 
} from "../controllers/authController.js";
import { auth } from "../middleware/authMiddleWare.js";
import upload from "../middleware/uploadMiddlewae.js";

const router = express.Router();

const optionalUpload = (req, res, next) => {
    if (req.headers["content-type"] && req.headers["content-type"].includes("multipart/form-data")) {
        return upload.single("profileImage")(req, res, next);
    }
    next();
};

router.post("/register", optionalUpload, register);
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", auth, getMe);

router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/send-verification", sendEmailVerification);
router.post("/verify-email", verifyEmail);

export default router;

