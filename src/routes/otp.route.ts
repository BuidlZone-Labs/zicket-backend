import { Router } from "express";
import { otpVerificationController } from "../controllers/otp.controller";

const otpRoute = Router();

otpRoute.post("/verify-otp", otpVerificationController);

export default otpRoute;
