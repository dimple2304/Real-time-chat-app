import express from 'express';
import {
  getMessagesBetweenUsers,
  sendMessage,
  getUserChats,
  getUnreadCounts,
  markMessagesAsRead,
  getLastReadMessage
} from '../controllers/messageController.js';

import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Specific routes must come before generic ones
router.get('/unread-counts/:username', verifyToken, getUnreadCounts);
router.get('/chats/:username', verifyToken, getUserChats);
router.put('/mark-read/:senderId/:receiverId', verifyToken, markMessagesAsRead);
router.get('/last-read/:senderId/:receiverId', verifyToken, getLastReadMessage);
router.get('/:user1/:user2', verifyToken, getMessagesBetweenUsers);
router.post('/', verifyToken, sendMessage);

export default router;
