import Message from "../models/message.js";
import User from "../models/user.js";

// Get messages between two users
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

// Get chat contacts
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



export const sendMessage = async (req, res) => {
    const { sender, receiver, content } = req.body;
    try {
        const senderUser = await User.findOne({ username: sender });
        const receiverUser = await User.findOne({ username: receiver });

        if (!senderUser || !receiverUser) return res.status(404).json({ message: "User(s) not found" });

        if (sender.username === receiver.username) {
            return res.status(400).json({ success: false, message: "Cannot send message to self" });
        }

        const message = new Message({
            sender: senderUser._id,
            receiver: receiverUser._id,
            content,
        });

        const saved = await message.save();

        // Update recent chats
        await User.findByIdAndUpdate(senderUser._id, {
            $addToSet: { recentChats: receiverUser._id },
        });

        await User.findByIdAndUpdate(receiverUser._id, {
            $addToSet: { recentChats: senderUser._id },
        });

        const full = await Message.findById(saved._id).populate("sender", "username").populate("receiver", "username");
        res.json(full);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to send message" });
    }
};



// Get unread count per sender for the current logged-in user
export const getUnreadCounts = async (req, res) => {
    try {
        const { username } = req.params;
        console.log("Unread counts requested for:", username);

        const user = await User.findOne({ username });
        console.log("Fetching unread counts for:", user);
        if (!user) {
            console.log("User not found:", username);
            return res.status(404).json({ message: "User not found", username });
        }

        const unreadMessages = await Message.find({
            receiver: user._id,
            isRead: false
        }).populate("sender", "username");

        const unreadCountMap = {};
        unreadMessages.forEach(msg => {
            const senderUsername = msg.sender.username;
            unreadCountMap[senderUsername] = (unreadCountMap[senderUsername] || 0) + 1;
        });

        res.json({ success: true, counts: unreadCountMap });
    } catch (err) {
        console.error("Error in getUnreadCounts:", err);
        res.status(500).json({ message: "Error fetching unread counts" });
    }
};




// Mark messages as read when receiver opens the chat
export const markMessagesAsRead = async (req, res) => {
    try {
        const { user1, user2 } = req.params;

        const receiver = await User.findOne({ username: user1 });
        const sender = await User.findOne({ username: user2 });

        if (!receiver || !sender)
            return res.status(404).json({ message: "User(s) not found" });

        await Message.updateMany(
            { sender: sender._id, receiver: receiver._id, isRead: false },
            { $set: { isRead: true } }
        );

        res.json({ success: true, message: "Messages marked as read" });
    } catch (err) {
        console.error("Failed to mark messages as read:", err);
        res.status(500).json({ message: "Failed to mark messages as read" });
    }
};

