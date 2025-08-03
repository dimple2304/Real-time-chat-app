import express from 'express';
import { userRegister, verifyOtp, loginUser } from '../controllers/authController.js';
import sendOtp from '../utils/sendMail.js';

const router = express.Router();

router.post('/signup', userRegister);
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/login', loginUser);

export default router;
