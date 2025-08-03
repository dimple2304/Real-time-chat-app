import express from 'express';
import { getAllUsers, getSuggestedUsers, onOffStatus } from '../controllers/userController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/', verifyToken, getAllUsers); // <-- /api/users (for sidebar)
router.get('/:username', verifyToken, getSuggestedUsers); // optional
router.get('/status/:username', verifyToken, onOffStatus); // optional

export default router;
