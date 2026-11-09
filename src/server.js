import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import helmet from "helmet";
import { connectdb } from "./config/db.js";
import authRoutes from "./routes/authRoute.js";
import userRoutes from "./routes/userRoute.js";
import availabilityRoutes from "./routes/availabilityRoute.js";
import medicalRecordRoutes from "./routes/medicalRecordRoute.js";
import appointmentRoutes from "./routes/appointmentRoute.js";
import aiRoutes from "./routes/aiRoute.js";
import adminRoutes from "./routes/adminRoute.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Trust reverse proxy for secure cookies in deployment (Render, AWS, etc.)
app.set("trust proxy", 1);

// Allowed frontend origins
const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:3003",
  "http://localhost:3004"
].filter(Boolean);

// Security Headers (Helmet.js - Section 6.1 Architecture)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS Configuration
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // Permissive in dev
  },
  credentials: true
}));

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));
app.use(cookieParser());

// Database Connection
connectdb();

// Core Application Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/availability", availabilityRoutes);
app.use("/api/medical", medicalRecordRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/admin", adminRoutes);

// Root route
app.get("/", (req, res) => {
  res.send("TeleDoc360 Intelligent Medical API is running...");
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!", error: err.message });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
