import { prisma } from "../config/db.js"

export const roleCheck = (allowedRoles = []) => {
    return async (req, res, next) => {
        if (!req.user?.id) {
            return res.status(401).json({ message: "Unauthorized" })
        }

        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { role: true }
        })

        if (!user) {
            return res.status(401).json({ message: "User not found" })
        }

        if (!allowedRoles.includes(user.role)) {
            return res.status(403).json({ message: "Forbidden" })
        }

        req.user.role = user.role // optional
        next()
    }
}
