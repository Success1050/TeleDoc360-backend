import { prisma } from "../config/db.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../utils/TokenGeneration.js";

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

            let profile;
            if (role === "PATIENT") {
                profile = await tx.patient.create({
                    data: {
                        userId: newUser.id,
                        firstName,
                        lastName,
                        phoneNumber,
                        dateOfBirth: new Date(dateOfBirth),
                        gender,
                        profilePicture // Added Cloudinary URL
                    }
                });
            } else if (role === "DOCTOR") {
                profile = await tx.doctor.create({
                    data: {
                        userId: newUser.id,
                        firstName,
                        lastName,
                        phoneNumber,
                        gender,
                        specialization,
                        qualifications: Array.isArray(qualifications) ? qualifications : [qualifications],
                        licenseNumber,
                        yearsOfExperience: parseInt(yearsOfExperience),
                        consultationFee: parseFloat(consultationFee),
                        profilePicture // Added Cloudinary URL
                    }
                });
            } else if (role === "ADMIN") {
                // No specific profile model for ADMIN in schema yet
                profile = null;
            }

            return { user: newUser, profile };
        });

        // 5. Generate token (sets cookie)
        await generateToken({
            id: result.user.id,
            email: result.user.email,
            role: result.user.role
        }, res);

        res.status(201).json({
            message: "User registered successfully",
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
        await generateToken({
            id: user.id,
            email: user.email,
            role: user.role
        }, res);

        res.json({
            message: "Login successful",
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
