import { EMAIL_USER, EMAIL_PASS } from '../config/index.js';
import nodemailer from 'nodemailer';

// In-memory OTP storage
export const otpStore = {};

const sendOtp = async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Missing email" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[email] = otp;

    try {
        const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 587,
            secure: false,
            auth: {
                user: EMAIL_USER,
                pass: EMAIL_PASS,
            },
        });

        await transporter.sendMail({
            from: `"D-Chat" <${EMAIL_USER}>`,
            to: email,
            subject: "Your OTP for D-Chat",
            html: `<b>Your OTP is: ${otp}</b>`,
        });

        res.status(200).json({ success: true, message: "OTP sent successfully" });
    } catch (err) {
        console.error("Email error:", err.message);
        res.status(500).json({ success: false, message: "Failed to send OTP" });
    }
};

export default sendOtp;
