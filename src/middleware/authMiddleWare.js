import { jwtVerify } from "jose"
import "dotenv/config"
import { prisma } from "../config/db.js"

export const auth = async (req, res, next) => {
    const endoded = new TextEncoder().encode(process.env.JWT_SECRET)

    let token

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
        token = req.headers.authorization.split(" ")[1]
    }

    if (req.cookies && req.cookies?.['jwt']) {
        token = req.cookies?.['jwt']
    }

    if (!token) {
        return res.status(401).json({
            status: "error",
            message: "token does not exists"
        })
    }

    try {
        const result = await jwtVerify(token, endoded, { algorithms: ["HS256"] })

        console.log(result);

        const { payload } = result

        const user = await prisma.user.findUnique({ where: { id: payload?.id } })

        if (!user) {
            return res.status(401).json({ error: "User not found" });
        }

        req.user = user
        next()
    } catch (error) {
        return res.status(401).json({
            status: "error from db",
            message: error
        })
    }


}