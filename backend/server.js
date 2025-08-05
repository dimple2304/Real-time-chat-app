import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from './config/db.js';
import { PORT } from './config/index.js';
import authRoutes from './routes/authentication.js';
import messageRoutes from './routes/messages.js';
import userRoutes from './routes/user.js';
import Message from './models/message.js';
import User from './models/user.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

connectDB();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));
app.use("/uploads", express.static(path.resolve("uploads"), {
  maxAge: "7d", // Cache for 7 days
  etag: false
}));

app.get('/', (req, res) => {
  res.redirect('/index.html');
});

app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);

const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('joinRoom', async (userId) => {
    socket.join(userId);
    socket.userId = userId;
    onlineUsers.set(userId, socket.id);

    try {
      await User.findByIdAndUpdate(userId, { isOnline: true });
      io.emit('user-status-change', { userId, isOnline: true });
    } catch (err) {
      console.error('Error updating online status:', err.message);
    }
  });

  socket.on("user-away", async ({ userId, lastSeen }) => {
    try {
      await User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastSeen
      });

      io.emit("user-status-change", {
        username: socket.username, // if available
        isOnline: false,
        lastSeen
      });

    } catch (err) {
      console.error("Error marking user away:", err.message);
    }
  });


  socket.on('user-back', async (userId) => {
    try {
      await User.findByIdAndUpdate(userId, { isOnline: true });
      io.emit('user-status-change', { userId, isOnline: true });
    } catch (err) {
      console.error('Error marking user back:', err.message);
    }
  });

  socket.on('manual-logout', async (userId) => {
    try {
      onlineUsers.delete(userId);
      await User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastSeen: new Date()
      });
      io.emit('user-status-change', {
        userId,
        isOnline: false,
        lastSeen: new Date()
      });
      socket.disconnect(true);
    } catch (err) {
      console.error('Error during manual logout:', err.message);
    }
  });

  socket.on('mark-seen', async ({ senderId, receiverId }) => {
    try {
      const unreadMessages = await Message.find({
        sender: senderId,
        receiver: receiverId,
        isRead: false
      });

      if (unreadMessages.length === 0) return;

      const messageIds = unreadMessages.map((msg) => msg._id);

      await Message.updateMany(
        { _id: { $in: messageIds } },
        { isRead: true }
      );

      // Get updated messages with populated data
      const updatedMessages = await Message.find({ _id: { $in: messageIds } })
        .populate('sender', 'username')
        .populate('receiver', 'username');

      // Notify sender for each message
      updatedMessages.forEach(msg => {
        io.to(msg.sender._id.toString()).emit('message-status-update', {
          messageId: msg._id,
          status: 'read',
          message: msg
        });
      });

    } catch (err) {
      console.error('Mark seen error:', err.message);
    }
  });

  socket.on('chatOpened', async ({ viewerId, chattingWithId }) => {
    try {
      const unseenMessages = await Message.find({
        sender: chattingWithId,
        receiver: viewerId,
        isRead: false
      });

      if (unseenMessages.length === 0) return;

      const messageIds = unseenMessages.map(m => m._id);
      await Message.updateMany({ _id: { $in: messageIds } }, { isRead: true });

      // Get updated messages with populated data
      const updatedMessages = await Message.find({ _id: { $in: messageIds } })
        .populate('sender', 'username')
        .populate('receiver', 'username');

      // Notify sender for each message
      updatedMessages.forEach(msg => {
        io.to(msg.sender._id.toString()).emit('message-status-update', {
          messageId: msg._id,
          status: 'read',
          message: msg,
          seenBy: viewerId,
          timestamp: new Date()
        });
      });

    } catch (err) {
      console.error("Error in chatOpened event:", err.message);
    }
  });

  socket.on('send-message', async ({ sender, receiver, content }) => {
    try {
      const senderUser = await User.findOne({ username: sender });
      const receiverUser = await User.findOne({ username: receiver });

      if (!senderUser || !receiverUser) return;

      const message = new Message({
        sender: senderUser._id,
        receiver: receiverUser._id,
        content
      });

      const saved = await message.save();

      // Update recent chats for both users
      await User.findByIdAndUpdate(senderUser._id, {
        $addToSet: { recentChats: receiverUser._id }
      });
      await User.findByIdAndUpdate(receiverUser._id, {
        $addToSet: { recentChats: senderUser._id }
      });

      const populatedMsg = await Message.findById(saved._id)
        .populate('sender', 'username')
        .populate('receiver', 'username');

      // Emit to both users immediately
      io.to(senderUser._id.toString()).emit('receive-message', populatedMsg);
      io.to(receiverUser._id.toString()).emit('receive-message', populatedMsg);

      // Update recent chats UI
      io.to(senderUser._id.toString()).emit('recent-chat-updated', {
        contact: receiverUser.username,
        lastMessage: content
      });
      io.to(receiverUser._id.toString()).emit('recent-chat-updated', {
        contact: senderUser.username,
        lastMessage: content
      });

      // Check if receiver is online and mark as delivered
      const receiverOnline = onlineUsers.has(receiverUser._id.toString());
      if (receiverOnline) {
        await Message.findByIdAndUpdate(saved._id, { isDelivered: true });
        const updatedMsg = await Message.findById(saved._id)
          .populate('sender', 'username')
          .populate('receiver', 'username');

        // Emit delivery update to sender
        io.to(senderUser._id.toString()).emit('message-status-update', {
          messageId: saved._id,
          status: 'delivered',
          message: updatedMsg
        });
      }

    } catch (err) {
      console.error('Error in socket send-message:', err.message);
    }
  });


  socket.on('joinRoom', async (userId) => {
    socket.join(userId);
    socket.userId = userId;
    onlineUsers.set(userId, socket.id);

    try {
      // Mark user as online
      await User.findByIdAndUpdate(userId, { isOnline: true });
      io.emit('user-status-change', { userId, isOnline: true });

      // Mark all pending messages as delivered
      const undeliveredMessages = await Message.find({
        receiver: userId,
        isDelivered: false
      });

      if (undeliveredMessages.length > 0) {
        await Message.updateMany(
          { _id: { $in: undeliveredMessages.map(m => m._id) } },
          { isDelivered: true }
        );

        // Notify senders that their messages were delivered
        for (const msg of undeliveredMessages) {
          const senderId = msg.sender.toString();
          const updatedMsg = await Message.findById(msg._id)
            .populate('sender', 'username')
            .populate('receiver', 'username');

          io.to(senderId).emit('message-status-update', {
            messageId: msg._id,
            status: 'delivered',
            message: updatedMsg
          });
        }
      }
    } catch (err) {
      console.error('Error updating online status:', err.message);
    }
  });

  socket.on("disconnect", async () => {
    if (socket.userId) {
      try {
        await User.findByIdAndUpdate(socket.userId, {
          isOnline: false,
          lastSeen: new Date()
        });

        const updatedUser = await User.findById(socket.userId);
        if (updatedUser) {
          io.emit("user-status-change", {
            userId: updatedUser._id.toString(),
            isOnline: updatedUser.isOnline,
            lastSeen: updatedUser.lastSeen
          });
        }
      } catch (err) {
        console.error("Error marking user away:", err.message);
      }
    }
  });

});

app.get('/test', (req, res) => {
  res.json('Server is running');
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
