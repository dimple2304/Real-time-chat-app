import express from 'express';
import { getAllUsers, getSuggestedUsers, getUserByUsername, logout, onOffStatus,   } from '../controllers/userController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/', verifyToken, getAllUsers); 
router.get('/:username', verifyToken, getSuggestedUsers);
router.get('/status/:username', verifyToken, onOffStatus); 
router.get('/find/:username', verifyToken, getUserByUsername);
router.post("/logout", verifyToken, logout);

// router.put("/update/:username", verifyToken, updateProfile);

export default router;
