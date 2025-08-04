import Message from "../models/message.js";
import User from "../models/user.js";

// Fetch complete message history between two users
export const getMessagesBetweenUsers = async (req, res) => {
  try {
    const { user1, user2 } = req.params;

    const sender = await User.findOne({ username: user1 });
    const receiver = await User.findOne({ username: user2 });

    if (!sender || !receiver)
      return res.status(404).json({ message: "User(s) not found" });

    const messages = await Message.find({
      $or: [
        { sender: sender._id, receiver: receiver._id },
        { sender: receiver._id, receiver: sender._id },
      ],
    })
      .sort({ createdAt: 1 })
      .populate("sender", "username")
      .populate("receiver", "username");

    res.json(messages);
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Fetch recent chat contacts and their last message content
export const getUserChats = async (req, res) => {
  const { username } = req.params;

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: "User not found" });

    const messages = await Message.find({
      $or: [{ sender: user._id }, { receiver: user._id }],
    })
      .populate("sender", "username")
      .populate("receiver", "username")
      .sort({ createdAt: -1 });

    const chatMap = new Map();

    messages.forEach((msg) => {
      const otherUser =
        msg.sender.username === username
          ? msg.receiver.username
          : msg.sender.username;

      if (!chatMap.has(otherUser)) {
        chatMap.set(otherUser, {
          contact: otherUser,
          lastMessage: msg.content,
        });
      }
    });

    res.json({ success: true, chats: Array.from(chatMap.values()) });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Handle new message creation
export const sendMessage = async (req, res) => {
  const { sender, receiver, content } = req.body;

  try {
    const senderUser = await User.findOne({ username: sender });
    const receiverUser = await User.findOne({ username: receiver });

    if (!senderUser || !receiverUser)
      return res.status(404).json({ message: "User(s) not found" });

    if (sender === receiver) {
      return res.status(400).json({ success: false, message: "Cannot send message to self" });
    }

    const message = new Message({
      sender: senderUser._id,
      receiver: receiverUser._id,
      content,
      isDelivered: false,
      isRead: false,
    });

    const saved = await message.save();

    // Maintain recent chats for both users
    await User.findByIdAndUpdate(senderUser._id, {
      $addToSet: { recentChats: receiverUser._id },
    });

    await User.findByIdAndUpdate(receiverUser._id, {
      $addToSet: { recentChats: senderUser._id },
    });

    const full = await Message.findById(saved._id)
      .populate("sender", "username")
      .populate("receiver", "username");

    res.json(full);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send message" });
  }
};

// Get unread message counts for each sender
export const getUnreadCounts = async (req, res) => {
  try {
    const { username } = req.params;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const unreadMessages = await Message.find({
      receiver: user._id,
      isRead: false,
    });

    const unreadCounts = {};

    unreadMessages.forEach((msg) => {
      const senderId = msg.sender.toString();
      unreadCounts[senderId] = (unreadCounts[senderId] || 0) + 1;
    });

    res.json(unreadCounts);
  } catch (error) {
    console.error("Error in getUnreadCounts:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Mark messages as read when receiver views the chat
export const markMessagesAsRead = async (req, res) => {
  const { senderId, receiverId } = req.params;

  try {
    await Message.updateMany(
      {
        sender: senderId,
        receiver: receiverId,
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          seenAt: new Date(),
        },
      }
    );

    res.status(200).json({ message: "Messages marked as read." });
  } catch (error) {
    console.error("Failed to mark messages as read:", error);
    res.status(500).json({ error: "Failed to mark messages as read" });
  }
};

// Mark undelivered messages as delivered when receiver comes online
export const markMessagesAsDelivered = async (req, res) => {
  const { userId } = req.params;

  try {
    await Message.updateMany(
      {
        receiver: userId,
        isDelivered: false,
      },
      {
        $set: {
          isDelivered: true,
          deliveredAt: new Date(),
        },
      }
    );

    res.status(200).json({ message: "Messages marked as delivered." });
  } catch (error) {
    console.error("Failed to mark messages as delivered:", error);
    res.status(500).json({ error: "Failed to mark messages as delivered" });
  }
};

// Fetch the last read message between two users (for blue tick)
export const getLastReadMessage = async (req, res) => {
  const { senderId, receiverId } = req.params;

  try {
    const lastRead = await Message.findOne({
      sender: senderId,
      receiver: receiverId,
      isRead: true,
    }).sort({ createdAt: -1 });

    res.json({ messageId: lastRead ? lastRead._id : null });
  } catch (error) {
    console.error("Error fetching last read message:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
