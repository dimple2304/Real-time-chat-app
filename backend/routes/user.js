import express from 'express';
import { getAllUsers, getSuggestedUsers, getUserByUsername, logout, onOffStatus, updateProfile, uploadFile,   } from '../controllers/userController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Create an "uploads" directory if it doesn't exist
const uploadDir = path.resolve('uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

//profile image
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Use original file name + timestamp
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    const uniqueName = `${baseName}-${Date.now()}${ext}`;
    cb(null, uniqueName);
  }
});

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit (optional)
  },
});

const router = express.Router();

router.get('/', verifyToken, getAllUsers); 
router.get('/:username', verifyToken, getSuggestedUsers);
router.get('/status/:username', verifyToken, onOffStatus); 
router.get('/find/:username', verifyToken, getUserByUsername);
router.post("/logout", verifyToken, logout);
router.put("/update/:username", verifyToken, updateProfile);
router.put('/upload',verifyToken, upload.single('file'), uploadFile);

export default router;
