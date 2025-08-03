// # User schema (email, username, password, profile, verified, status)
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },

    email: {
        type: String,
        required: true,
        trim: true
    },

    password: {
        type: String,
        required: true
    },

    isVerified: {
        type: Boolean,
        default: false
    },

    profilePic: {
        type: String,
        default: ''
    },

    bio: {
        type: String,
        default: '',
        maxlength: 150
    },

    isOnline: {
        type: Boolean,
        default: null
    },

    lastSeen: {
        type: Date,
        default: null
    },

    recentChats: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    }]

}, { timestamps: true });

const user = mongoose.model('user', userSchema);
export default user;