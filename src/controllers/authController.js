import { prisma } from "../config/db.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../utils/TokenGeneration.js";
import crypto from "crypto";

export const register = async (req, res) => {
    try {
        const {
            email,
            password,
            role,
            // Common profile fields
            firstName,
            lastName,
            phoneNumber,
            gender,
            // Patient specific
            dateOfBirth,
            // Doctor specific
            specialization,
            qualifications,
            licenseNumber,
            yearsOfExperience,
            consultationFee
        } = req.body;

        // Get profile image URL from Cloudinary (if uploaded)
        const profilePicture = req.file ? req.file.path : null;

        // 1. Basic Validation
        if (!email || !password || !role) {
            return res.status(400).json({ message: "Email, password and role are required" });
        }

        // 2. Check if user exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }

        // 3. Hash password
        const passwordHash = await bcrypt.hash(password, 12);

        // 4. Create User and Profile in transaction
        const result = await prisma.$transaction(async (tx) => {
            const newUser = await tx.user.create({
                data: {
                    email,
                    passwordHash,
                    role,
                    isActive: true, // Verification skipped for now
                    isEmailVerified: true // Skipping verification for now as requested
                }
            });

            const resolvedGender = gender && ["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"].includes(gender) 
                ? gender 
                : "PREFER_NOT_TO_SAY";

            let profile;
            if (role === "PATIENT") {
                profile = await tx.patient.create({
                    data: {
                        userId: newUser.id,
                        firstName: firstName || "Patient",
                        lastName: lastName || "User",
                        phoneNumber: phoneNumber || null,
                        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : new Date("2000-01-01"),
                        gender: resolvedGender,
                        profilePicture
                    }
                });
            } else if (role === "DOCTOR") {
                profile = await tx.doctor.create({
                    data: {
                        userId: newUser.id,
                        firstName: firstName || "Dr.",
                        lastName: lastName || "Doctor",
                        phoneNumber: phoneNumber || null,
                        gender: resolvedGender,
                        specialization: specialization || "General Medicine",
                        qualifications: qualifications ? (Array.isArray(qualifications) ? qualifications : [qualifications]) : ["MBBS"],
                        licenseNumber: licenseNumber || `LIC-${Date.now().toString().slice(-6)}`,
                        yearsOfExperience: parseInt(yearsOfExperience) || 1,
                        consultationFee: parseFloat(consultationFee) || 50.00,
                        profilePicture
                    }
                });
            } else if (role === "ADMIN") {
                // No specific profile model for ADMIN in schema yet
                profile = null;
            }

            return { user: newUser, profile };
        });

        // 5. Generate token (sets cookie)
        const token = await generateToken({
            id: result.user.id,
            email: result.user.email,
            role: result.user.role
        }, res);

        res.status(201).json({
            message: "User registered successfully",
            token,
            user: {
                id: result.user.id,
                email: result.user.email,
                role: result.user.role
            },
            profile: result.profile
        });

    } catch (error) {
        console.error("Register Error:", error);
        res.status(500).json({ message: "Registration failed", error: error.message });
    }
};

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        // 1. Find user
        const user = await prisma.user.findUnique({
            where: { email },
            include: {
                patient: true,
                doctor: true
            }
        });

        if (!user) {
            return res.status(401).json({ message: "user not found" });
        }

        // 2. Check password
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // 3. Update last login
        await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() }
        });

        // 4. Generate token
        const token = await generateToken({
            id: user.id,
            email: user.email,
            role: user.role
        }, res);

        res.json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                profile: user.role === "PATIENT" ? user.patient : user.doctor
            },
        });

    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: "Login failed", error: error.message });
    }
};

export const logout = async (req, res) => {
    res.clearCookie("token");
    res.json({ message: "Logged out successfully" });
};

// 4. Get Current User Profile
export const getMe = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                email: true,
                role: true,
                isEmailVerified: true,
                isActive: true,
                emailVerifiedAt: true,
                lastLoginAt: true,
                createdAt: true,
                patient: true,
                doctor: true
            }
        });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({ user });
    } catch (error) {
        console.error("GetMe Error:", error);
        res.status(500).json({ message: "Failed to retrieve user profile", error: error.message });
    }
};

// 5. Forgot Password (Request Reset Token)
export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            // Return success anyway to avoid user enumeration
            return res.json({ message: "If an account exists with this email, a reset token has been issued." });
        }

        const resetToken = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour validity

        // Save token in DB
        await prisma.passwordResetToken.create({
            data: {
                email,
                token: resetToken,
                expiresAt
            }
        });

        // Response with token (for frontend/API integration until SendGrid/SMTP is bound)
        res.json({
            message: "Password reset token generated successfully",
            resetToken,
            expiresAt
        });
    } catch (error) {
        console.error("Forgot Password Error:", error);
        res.status(500).json({ message: "Failed to process forgot password", error: error.message });
    }
};

// 6. Reset Password (Verify Token & Update Hash)
export const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) {
            return res.status(400).json({ message: "Token and new password are required" });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters" });
        }

        const resetRecord = await prisma.passwordResetToken.findUnique({
            where: { token }
        });

        if (!resetRecord || resetRecord.usedAt !== null || resetRecord.expiresAt < new Date()) {
            return res.status(400).json({ message: "Invalid or expired reset token" });
        }

        const passwordHash = await bcrypt.hash(newPassword, 12);

        await prisma.$transaction([
            prisma.user.update({
                where: { email: resetRecord.email },
                data: { passwordHash }
            }),
            prisma.passwordResetToken.update({
                where: { id: resetRecord.id },
                data: { usedAt: new Date() }
            })
        ]);

        res.json({ message: "Password has been reset successfully. You can now log in." });
    } catch (error) {
        console.error("Reset Password Error:", error);
        res.status(500).json({ message: "Failed to reset password", error: error.message });
    }
};

// 7. Send Email Verification Token
export const sendEmailVerification = async (req, res) => {
    try {
        const email = req.user?.email || req.body.email;
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours validity

        await prisma.emailVerificationToken.create({
            data: {
                email,
                token,
                expiresAt
            }
        });

        res.json({
            message: "Email verification token generated successfully",
            verificationToken: token,
            expiresAt
        });
    } catch (error) {
        console.error("Send Verification Error:", error);
        res.status(500).json({ message: "Failed to send email verification", error: error.message });
    }
};

// 8. Verify Email Token
export const verifyEmail = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ message: "Verification token is required" });
        }

        const record = await prisma.emailVerificationToken.findUnique({
            where: { token }
        });

        if (!record || record.verifiedAt !== null || record.expiresAt < new Date()) {
            return res.status(400).json({ message: "Invalid or expired verification token" });
        }

        await prisma.$transaction([
            prisma.user.update({
                where: { email: record.email },
                data: {
                    isEmailVerified: true,
                    emailVerifiedAt: new Date()
                }
            }),
            prisma.emailVerificationToken.update({
                where: { id: record.id },
                data: { verifiedAt: new Date() }
            })
        ]);

        res.json({ message: "Email verified successfully" });
    } catch (error) {
        console.error("Verify Email Error:", error);
        res.status(500).json({ message: "Failed to verify email", error: error.message });
    }
};

