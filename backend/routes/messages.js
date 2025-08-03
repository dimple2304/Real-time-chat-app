import express from "express";
import {
  getMessagesBetweenUsers,
  getUserChats,
  sendMessage,
  getUnreadCounts,
  markMessagesAsRead
} from "../controllers/messageController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/chats/:username", verifyToken, getUserChats);
router.get("/:user1/:user2", verifyToken, getMessagesBetweenUsers);
router.post("/", verifyToken, sendMessage);
router.get('/unread-counts/:username', getUnreadCounts);
router.put('/mark-read/:user1/:user2',verifyToken, markMessagesAsRead);


export default router;
