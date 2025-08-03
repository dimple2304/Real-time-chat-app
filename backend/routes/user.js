import express from 'express';
import { getAllUsers, getSuggestedUsers, getUserByUsername, onOffStatus,  } from '../controllers/userController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/', verifyToken, getAllUsers); // <-- /api/users (for sidebar)
router.get('/:username', verifyToken, getSuggestedUsers); // optional
router.get('/status/:username', verifyToken, onOffStatus); // optional
router.get('/find/:username', verifyToken, getUserByUsername);

export default router;
