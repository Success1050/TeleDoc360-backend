import { prisma } from "../config/db.js";

// Helper to fetch onboarding data for a single doctor
export const getDoctorOnboardingData = async (doctorId) => {
    try {
        const setting = await prisma.systemSetting.findUnique({
            where: { key: `doctor_onboarding:${doctorId}` }
        });
        if (!setting || !setting.value) return null;
        return JSON.parse(setting.value);
    } catch {
        return null;
    }
};

// Helper to fetch onboarding data for multiple doctors
export const getAllDoctorOnboardingMap = async (doctorIds) => {
    try {
        if (!doctorIds || doctorIds.length === 0) return {};
        const keys = doctorIds.map(id => `doctor_onboarding:${id}`);
        const settings = await prisma.systemSetting.findMany({
            where: { key: { in: keys } }
        });
        const map = {};
        for (const s of settings) {
            const docId = s.key.replace("doctor_onboarding:", "");
            try {
                map[docId] = JSON.parse(s.value);
            } catch {
                map[docId] = null;
            }
        }
        return map;
    } catch {
        return {};
    }
};

// ============================================
// PATIENT PROFILES
// ============================================

// Get Current Patient Profile
export const getPatientProfile = async (req, res) => {
    try {
        const patient = await prisma.patient.findUnique({
            where: { userId: req.user.id },
            include: {
                allergies: true,
                user: {
                    select: {
                        email: true,
                        role: true,
                        isEmailVerified: true,
                        createdAt: true
                    }
                }
            }
        });

        if (!patient) {
            return res.status(404).json({ message: "Patient profile not found" });
        }

        res.json({ patient });
    } catch (error) {
        console.error("Get Patient Profile Error:", error);
        res.status(500).json({ message: "Failed to retrieve profile", error: error.message });
    }
};

// Update Patient Profile
export const updatePatientProfile = async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            phoneNumber,
            dateOfBirth,
            gender,
            address,
            city,
            state,
            country,
            emergencyContact,
            bloodGroup
        } = req.body;

        const updateData = {};
        if (firstName) updateData.firstName = firstName;
        if (lastName) updateData.lastName = lastName;
        if (phoneNumber) updateData.phoneNumber = phoneNumber;
        if (dateOfBirth) updateData.dateOfBirth = new Date(dateOfBirth);
        if (gender) updateData.gender = gender;
        if (address) updateData.address = address;
        if (city) updateData.city = city;
        if (state) updateData.state = state;
        if (country) updateData.country = country;
        if (emergencyContact) updateData.emergencyContact = emergencyContact;
        if (bloodGroup) updateData.bloodGroup = bloodGroup;

        // Profile picture update from upload middleware if provided
        if (req.file) {
            updateData.profilePicture = req.file.path;
            updateData.profileImage = req.file.path;
        }

        const patient = await prisma.patient.update({
            where: { userId: req.user.id },
            data: updateData
        });

        res.json({ message: "Profile updated successfully", patient });
    } catch (error) {
        console.error("Update Patient Profile Error:", error);
        res.status(500).json({ message: "Failed to update profile", error: error.message });
    }
};

// ============================================
// DOCTOR PROFILES & ONBOARDING
// ============================================

// Get Current Doctor Profile
export const getDoctorProfile = async (req, res) => {
    try {
        const doctor = await prisma.doctor.findUnique({
            where: { userId: req.user.id },
            include: {
                availabilitySlots: true,
                user: {
                    select: {
                        email: true,
                        role: true,
                        isEmailVerified: true,
                        createdAt: true
                    }
                }
            }
        });

        if (!doctor) {
            return res.status(404).json({ message: "Doctor profile not found" });
        }

        const onboarding = await getDoctorOnboardingData(doctor.id);

        res.json({
            doctor: {
                ...doctor,
                onboarding
            }
        });
    } catch (error) {
        console.error("Get Doctor Profile Error:", error);
        res.status(500).json({ message: "Failed to retrieve doctor profile", error: error.message });
    }
};

// Submit Doctor Onboarding & Credentialing Application
export const submitDoctorOnboarding = async (req, res) => {
    try {
        const existingDoctor = await prisma.doctor.findUnique({
            where: { userId: req.user.id }
        });

        if (!existingDoctor) {
            return res.status(404).json({ message: "Doctor profile not found" });
        }

        const {
            firstName,
            lastName,
            phoneNumber,
            gender,
            specialization,
            subSpecialty,
            qualifications,
            licenseNumber,
            licenseAuthority,
            licenseIssueDate,
            licenseExpiryDate,
            medicalSchool,
            graduationYear,
            hospitalAffiliation,
            practiceAddress,
            city,
            state,
            yearsOfExperience,
            consultationFee,
            bio,
            documents
        } = req.body;

        if (!specialization || !licenseNumber) {
            return res.status(400).json({ message: "Specialization and Medical License Number are required" });
        }

        // Check if licenseNumber is used by another doctor
        if (licenseNumber !== existingDoctor.licenseNumber) {
            const duplicateLicense = await prisma.doctor.findUnique({
                where: { licenseNumber: licenseNumber.trim() }
            });
            if (duplicateLicense && duplicateLicense.id !== existingDoctor.id) {
                return res.status(409).json({ message: "This Medical License Number is already registered to another practitioner" });
            }
        }

        const parsedQualifications = Array.isArray(qualifications)
            ? qualifications
            : typeof qualifications === "string"
                ? qualifications.split(",").map(q => q.trim()).filter(Boolean)
                : existingDoctor.qualifications;

        const updateData = {
            firstName: firstName ? firstName.trim() : existingDoctor.firstName,
            lastName: lastName ? lastName.trim() : existingDoctor.lastName,
            phoneNumber: phoneNumber !== undefined ? phoneNumber : existingDoctor.phoneNumber,
            gender: gender || existingDoctor.gender,
            specialization: specialization.trim(),
            qualifications: parsedQualifications.length > 0 ? parsedQualifications : ["MBBS"],
            licenseNumber: licenseNumber.trim(),
            yearsOfExperience: yearsOfExperience !== undefined ? parseInt(yearsOfExperience) || 0 : existingDoctor.yearsOfExperience,
            consultationFee: consultationFee !== undefined ? parseFloat(consultationFee) || 50 : existingDoctor.consultationFee,
            bio: bio !== undefined ? bio : existingDoctor.bio,
            isApproved: false // Set pending admin approval upon onboarding submission
        };

        const updatedDoctor = await prisma.doctor.update({
            where: { id: existingDoctor.id },
            data: updateData
        });

        const onboardingPayload = {
            onboardingCompleted: true,
            status: "PENDING_REVIEW",
            submittedAt: new Date().toISOString(),
            subSpecialty: subSpecialty || "",
            licenseAuthority: licenseAuthority || "Medical and Dental Council of Nigeria (MDCN)",
            licenseIssueDate: licenseIssueDate || "",
            licenseExpiryDate: licenseExpiryDate || "",
            medicalSchool: medicalSchool || "",
            graduationYear: graduationYear || "",
            hospitalAffiliation: hospitalAffiliation || "",
            practiceAddress: practiceAddress || "",
            city: city || "",
            state: state || "",
            documents: {
                medicalLicense: documents?.medicalLicense || null,
                medicalDegree: documents?.medicalDegree || null,
                governmentId: documents?.governmentId || null
            },
            adminReviewNotes: "",
            reviewedAt: null
        };

        await prisma.systemSetting.upsert({
            where: { key: `doctor_onboarding:${existingDoctor.id}` },
            update: {
                value: JSON.stringify(onboardingPayload),
                description: `Doctor Onboarding & Credentialing Application for Dr. ${updatedDoctor.firstName} ${updatedDoctor.lastName}`
            },
            create: {
                key: `doctor_onboarding:${existingDoctor.id}`,
                value: JSON.stringify(onboardingPayload),
                description: `Doctor Onboarding & Credentialing Application for Dr. ${updatedDoctor.firstName} ${updatedDoctor.lastName}`,
                isEditable: true
            }
        });

        await prisma.auditLog.create({
            data: {
                userId: req.user.id,
                action: "SUBMIT_DOCTOR_ONBOARDING",
                entity: "Doctor",
                entityId: existingDoctor.id,
                changes: {
                    licenseNumber: updatedDoctor.licenseNumber,
                    specialization: updatedDoctor.specialization,
                    hospitalAffiliation: onboardingPayload.hospitalAffiliation,
                    documentsSubmitted: {
                        medicalLicense: Boolean(documents?.medicalLicense?.fileUrl),
                        medicalDegree: Boolean(documents?.medicalDegree?.fileUrl),
                        governmentId: Boolean(documents?.governmentId?.fileUrl)
                    }
                }
            }
        });

        res.json({
            message: "Onboarding application and verification documents submitted! Your account is now pending administrative approval.",
            doctor: {
                ...updatedDoctor,
                onboarding: onboardingPayload
            }
        });
    } catch (error) {
        console.error("Submit Doctor Onboarding Error:", error);
        res.status(500).json({ message: "Failed to submit onboarding application", error: error.message });
    }
};

// Update Doctor Profile
export const updateDoctorProfile = async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            phoneNumber,
            gender,
            specialization,
            qualifications,
            yearsOfExperience,
            consultationFee,
            bio
        } = req.body;

        const updateData = {};
        if (firstName) updateData.firstName = firstName;
        if (lastName) updateData.lastName = lastName;
        if (phoneNumber) updateData.phoneNumber = phoneNumber;
        if (gender) updateData.gender = gender;
        if (specialization) updateData.specialization = specialization;
        if (qualifications) {
            updateData.qualifications = Array.isArray(qualifications) ? qualifications : [qualifications];
        }
        if (yearsOfExperience !== undefined) {
            updateData.yearsOfExperience = parseInt(yearsOfExperience);
        }
        if (consultationFee !== undefined) {
            updateData.consultationFee = parseFloat(consultationFee);
        }
        if (bio !== undefined) updateData.bio = bio;

        if (req.file) {
            updateData.profilePicture = req.file.path;
            updateData.profileImage = req.file.path;
        }

        const doctor = await prisma.doctor.update({
            where: { userId: req.user.id },
            data: updateData
        });

        const onboarding = await getDoctorOnboardingData(doctor.id);

        res.json({
            message: "Doctor profile updated successfully",
            doctor: {
                ...doctor,
                onboarding
            }
        });
    } catch (error) {
        console.error("Update Doctor Profile Error:", error);
        res.status(500).json({ message: "Failed to update doctor profile", error: error.message });
    }
};

// Toggle Doctor Availability
export const toggleDoctorAvailability = async (req, res) => {
    try {
        const doctor = await prisma.doctor.findUnique({
            where: { userId: req.user.id }
        });

        if (!doctor) {
            return res.status(404).json({ message: "Doctor profile not found" });
        }

        const updatedDoctor = await prisma.doctor.update({
            where: { id: doctor.id },
            data: { isAvailableForBooking: !doctor.isAvailableForBooking }
        });

        res.json({
            message: `Booking availability is now ${updatedDoctor.isAvailableForBooking ? "Enabled" : "Disabled"}`,
            isAvailableForBooking: updatedDoctor.isAvailableForBooking
        });
    } catch (error) {
        console.error("Toggle Availability Error:", error);
        res.status(500).json({ message: "Failed to toggle availability", error: error.message });
    }
};

// ============================================
// DOCTOR DIRECTORY & DISCOVERY (PUBLIC / AUTH)
// ============================================

// Get All Doctors with Search, Filter & Pagination
export const getAllDoctors = async (req, res) => {
    try {
        const {
            search,
            specialization,
            minRating,
            maxFee,
            isAvailable,
            sortBy = "rating",
            sortOrder = "desc",
            page = 1,
            limit = 50
        } = req.query;

        const where = {
            user: {
                isActive: true
            }
        };

        if (specialization) {
            where.specialization = {
                contains: specialization,
                mode: "insensitive"
            };
        }

        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { bio: { contains: search, mode: "insensitive" } },
                { specialization: { contains: search, mode: "insensitive" } }
            ];
        }

        if (minRating) {
            where.rating = { gte: parseFloat(minRating) };
        }

        if (maxFee) {
            where.consultationFee = { lte: parseFloat(maxFee) };
        }

        if (isAvailable !== undefined) {
            where.isAvailableForBooking = isAvailable === "true";
        }

        // Sorting options
        let orderBy = {};
        if (sortBy === "rating") {
            orderBy = { rating: sortOrder };
        } else if (sortBy === "fee") {
            orderBy = { consultationFee: sortOrder };
        } else if (sortBy === "experience") {
            orderBy = { yearsOfExperience: sortOrder };
        } else if (sortBy === "reputation") {
            orderBy = { reputationScore: sortOrder };
        } else {
            orderBy = { createdAt: "desc" };
        }

        const pageNum = parseInt(page) || 1;
        const pageSize = parseInt(limit) || 50;
        const skip = (pageNum - 1) * pageSize;

        const [doctors, total] = await Promise.all([
            prisma.doctor.findMany({
                where,
                orderBy,
                skip,
                take: pageSize,
                select: {
                    id: true,
                    userId: true,
                    firstName: true,
                    lastName: true,
                    phoneNumber: true,
                    gender: true,
                    specialization: true,
                    qualifications: true,
                    licenseNumber: true,
                    yearsOfExperience: true,
                    consultationFee: true,
                    bio: true,
                    profilePicture: true,
                    profileImage: true,
                    rating: true,
                    totalRatings: true,
                    reputationScore: true,
                    rewardPoints: true,
                    isAvailableForBooking: true,
                    isApproved: true,
                    createdAt: true,
                    user: {
                        select: {
                            email: true,
                            createdAt: true
                        }
                    }
                }
            }),
            prisma.doctor.count({ where })
        ]);

        const onboardingMap = await getAllDoctorOnboardingMap(doctors.map(d => d.id));
        const enrichedDoctors = doctors.map(d => ({
            ...d,
            onboarding: onboardingMap[d.id] || null
        }));

        res.json({
            doctors: enrichedDoctors,
            pagination: {
                total,
                page: pageNum,
                totalPages: Math.ceil(total / pageSize),
                limit: pageSize
            }
        });
    } catch (error) {
        console.error("Get All Doctors Error:", error);
        res.status(500).json({ message: "Failed to retrieve doctors directory", error: error.message });
    }
};

// Get Doctor By ID
export const getDoctorById = async (req, res) => {
    try {
        const { id } = req.params;

        const doctor = await prisma.doctor.findUnique({
            where: { id },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                phoneNumber: true,
                gender: true,
                specialization: true,
                qualifications: true,
                licenseNumber: true,
                yearsOfExperience: true,
                consultationFee: true,
                bio: true,
                profilePicture: true,
                profileImage: true,
                rating: true,
                totalRatings: true,
                reputationScore: true,
                isAvailableForBooking: true,
                isApproved: true,
                user: {
                    select: {
                        email: true,
                        createdAt: true
                    }
                },
                availabilitySlots: {
                    where: { status: "AVAILABLE" }
                }
            }
        });

        if (!doctor) {
            return res.status(404).json({ message: "Doctor not found" });
        }

        const onboarding = await getDoctorOnboardingData(doctor.id);

        res.json({
            doctor: {
                ...doctor,
                onboarding
            }
        });
    } catch (error) {
        console.error("Get Doctor By ID Error:", error);
        res.status(500).json({ message: "Failed to retrieve doctor details", error: error.message });
    }
};

// ============================================
// ACCOUNT MANAGEMENT
// ============================================

// Deactivate Account
export const deactivateAccount = async (req, res) => {
    try {
        await prisma.user.update({
            where: { id: req.user.id },
            data: { isActive: false }
        });

        res.clearCookie("token");
        res.json({ message: "Account has been deactivated successfully" });
    } catch (error) {
        console.error("Deactivate Account Error:", error);
        res.status(500).json({ message: "Failed to deactivate account", error: error.message });
    }
};

// Get All Patients (for Doctors & Admins)
export const getAllPatients = async (req, res) => {
    try {
        const patients = await prisma.patient.findMany({
            include: {
                user: {
                    select: {
                        email: true,
                        isActive: true
                    }
                }
            },
            orderBy: { createdAt: "desc" },
            take: 50
        });

        res.json({ patients });
    } catch (error) {
        console.error("Get All Patients Error:", error);
        res.status(500).json({ message: "Failed to load patients", error: error.message });
    }
};
