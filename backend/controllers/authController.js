import User from '../models/user.js';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { otpStore } from '../utils/sendMail.js';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config/index.js';


export const userRegister = async (req, res, next) => {
    try {
        console.log("BODY:", req.body);
        const { username, password, email, isVerified, profilePic, bio, isOnline } = req.body;

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(409).json({ message: 'Username already exists!' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const verifyingStatus = true;

        const newUser = new User({
            _id: new mongoose.Types.ObjectId(),
            username,
            email,
            password: hashedPassword,
            isVerified: verifyingStatus,
            profilePic,
            bio,
            isOnline
        });

        const savedUser = await newUser.save();

        console.log(`User created: ${savedUser.username}`);
        res.status(201).json({
            success: true,
            userdetails: {
                userId: savedUser._id,
                username: savedUser.username,
                email: savedUser.email,
                password: savedUser.password,
            }
        });

    } catch (err) {
        console.error('Error during registration:', err);
        res.status(500).json({ error: 'Something went wrong' });
    }
};


export const verifyOtp = async (req, res) => {
    const { email, otp } = req.body;
    if (otpStore[email] === otp) {
        delete otpStore[email];
        res.status(200).json({ success: true });
    } else {
        res.status(400).json({ success: false, message: "Invalid OTP" });
    }
}


export const loginUser = async (req, res, next) => {
    const { username, password } = req.body;
    console.log("Login Attempt:", username, password);
    try {

        const existingUser = await User.findOne({ username });

        if (!existingUser) {
            return res.json({ success: false, message: "User not found" });
        }

        const isMatch = await bcrypt.compare(password, existingUser.password);
        if (!isMatch) {
            return res.json({ success: false, message: "Incorrect password" });
        }

        existingUser.isOnline = true;
        await existingUser.save();

        console.log("login successfull")
        const token = jwt.sign(
            { id: existingUser._id, username: existingUser.username },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN || '1d' }
        );

        return res.status(200).json({
            success: true,
            message: "Login successful",
            redirect: "/chat.html",
            token: token,
            user: {
                _id: existingUser._id,
                username: existingUser.username,
                email: existingUser.email,
            }
        });
    } catch (err) {
        return err;
    }
}

