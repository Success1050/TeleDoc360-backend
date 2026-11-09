import { prisma } from "../config/db.js";

// ============================================
// DOCTOR AVAILABILITY SLOTS
// ============================================

// 1. Create or Batch Define Recurring Slots
export const createAvailabilitySlots = async (req, res) => {
    try {
        const doctor = await prisma.doctor.findUnique({
            where: { userId: req.user.id }
        });

        if (!doctor) {
            return res.status(404).json({ message: "Doctor profile not found" });
        }

        const { slots } = req.body;
        // slots can be single object or array: [{ dayOfWeek, startTime, endTime, isRecurring }]
        const slotList = Array.isArray(slots) ? slots : [req.body];

        if (!slotList.length || !slotList[0].startTime || !slotList[0].endTime) {
            return res.status(400).json({ message: "startTime and endTime are required" });
        }

        const createdSlots = await prisma.$transaction(
            slotList.map(slot =>
                prisma.availabilitySlot.create({
                    data: {
                        doctorId: doctor.id,
                        dayOfWeek: slot.dayOfWeek !== undefined ? parseInt(slot.dayOfWeek) : 1, // 0=Sun, 1=Mon...
                        startTime: slot.startTime, // Format "HH:MM" e.g. "09:00"
                        endTime: slot.endTime,     // Format "HH:MM" e.g. "17:00"
                        date: slot.date ? new Date(slot.date) : null,
                        status: slot.status || "AVAILABLE",
                        isRecurring: slot.isRecurring !== undefined ? Boolean(slot.isRecurring) : true
                    }
                })
            )
        );

        res.status(201).json({
            message: "Availability slots created successfully",
            count: createdSlots.length,
            slots: createdSlots
        });
    } catch (error) {
        console.error("Create Slots Error:", error);
        res.status(500).json({ message: "Failed to create availability slots", error: error.message });
    }
};

// 2. Block Unavailable Period (Vacation, Leave, Emergency)
export const blockAvailabilitySlot = async (req, res) => {
    try {
        const doctor = await prisma.doctor.findUnique({
            where: { userId: req.user.id }
        });

        if (!doctor) {
            return res.status(404).json({ message: "Doctor profile not found" });
        }

        const { date, startTime = "00:00", endTime = "23:59", dayOfWeek } = req.body;

        if (!date && dayOfWeek === undefined) {
            return res.status(400).json({ message: "Date or dayOfWeek is required to block a time window" });
        }

        const blockedSlot = await prisma.availabilitySlot.create({
            data: {
                doctorId: doctor.id,
                dayOfWeek: dayOfWeek !== undefined ? parseInt(dayOfWeek) : new Date(date).getDay(),
                startTime,
                endTime,
                date: date ? new Date(date) : null,
                status: "BLOCKED",
                isRecurring: !date
            }
        });

        res.status(201).json({
            message: "Time window successfully blocked",
            slot: blockedSlot
        });
    } catch (error) {
        console.error("Block Slot Error:", error);
        res.status(500).json({ message: "Failed to block slot", error: error.message });
    }
};

// 3. Get Doctor's Own Slots (Doctor Dashboard)
export const getMyAvailabilitySlots = async (req, res) => {
    try {
        const doctor = await prisma.doctor.findUnique({
            where: { userId: req.user.id }
        });

        if (!doctor) {
            return res.status(404).json({ message: "Doctor profile not found" });
        }

        const slots = await prisma.availabilitySlot.findMany({
            where: { doctorId: doctor.id },
            orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }]
        });

        res.json({ slots });
    } catch (error) {
        console.error("Get My Slots Error:", error);
        res.status(500).json({ message: "Failed to fetch availability slots", error: error.message });
    }
};

// 4. Get Available Booking Slots for a Doctor on a Given Date (Public / Patient View)
export const getDoctorSlotsForDate = async (req, res) => {
    try {
        const { doctorId } = req.params;
        const { date } = req.query; // Format: "YYYY-MM-DD"

        if (!date) {
            return res.status(400).json({ message: "Query parameter 'date' (YYYY-MM-DD) is required" });
        }

        const targetDate = new Date(date);
        const dayOfWeek = targetDate.getDay(); // 0 = Sun, 1 = Mon ...

        // Fetch recurring slots for this day of week, plus any specific date overrides
        const allSlots = await prisma.availabilitySlot.findMany({
            where: {
                doctorId,
                OR: [
                    { dayOfWeek, isRecurring: true },
                    {
                        date: {
                            gte: new Date(`${date}T00:00:00.000Z`),
                            lte: new Date(`${date}T23:59:59.999Z`)
                        }
                    }
                ]
            },
            orderBy: { startTime: "asc" }
        });

        // Filter out blocked slots and already booked appointments
        const startOfDay = new Date(`${date}T00:00:00.000Z`);
        const endOfDay = new Date(`${date}T23:59:59.999Z`);

        const bookedAppointments = await prisma.appointment.findMany({
            where: {
                doctorId,
                appointmentDate: {
                    gte: startOfDay,
                    lte: endOfDay
                },
                status: {
                    in: ["REQUESTED", "APPROVED", "CONFIRMED", "IN_PROGRESS"]
                }
            },
            select: {
                appointmentTime: true,
                duration: true
            }
        });

        // Format booked times (HH:MM)
        const bookedTimes = bookedAppointments.map(app => {
            const timeObj = new Date(app.appointmentTime);
            return `${String(timeObj.getUTCHours()).padStart(2, "0")}:${String(timeObj.getUTCMinutes()).padStart(2, "0")}`;
        });

        // Only return slots that are AVAILABLE and not blocked
        const availableSlots = allSlots.filter(s => s.status === "AVAILABLE" && !bookedTimes.includes(s.startTime));

        res.json({
            date,
            dayOfWeek,
            totalSlots: allSlots.length,
            availableSlots,
            allSlots
        });
    } catch (error) {
        console.error("Get Doctor Slots Error:", error);
        res.status(500).json({ message: "Failed to retrieve slots", error: error.message });
    }
};

// 5. Update / Toggle / Delete Slot
export const deleteAvailabilitySlot = async (req, res) => {
    try {
        const { id } = req.params;

        const doctor = await prisma.doctor.findUnique({
            where: { userId: req.user.id }
        });

        if (!doctor) {
            return res.status(404).json({ message: "Doctor profile not found" });
        }

        const slot = await prisma.availabilitySlot.findUnique({ where: { id } });
        if (!slot || slot.doctorId !== doctor.id) {
            return res.status(403).json({ message: "Slot not found or unauthorized" });
        }

        await prisma.availabilitySlot.delete({ where: { id } });

        res.json({ message: "Availability slot deleted successfully" });
    } catch (error) {
        console.error("Delete Slot Error:", error);
        res.status(500).json({ message: "Failed to delete slot", error: error.message });
    }
};
