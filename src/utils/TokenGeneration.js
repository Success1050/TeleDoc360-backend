import { SignJWT } from "jose";
import "dotenv/config";

export const generateToken = async (payload, res) => {
  const secretKey = process.env.JWT_SECRET;
  if (!secretKey) throw new Error("Missing session secret key");
  const encodedKey = new TextEncoder().encode(secretKey);
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encodedKey);

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  return token;
};
