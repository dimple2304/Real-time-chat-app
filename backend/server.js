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
  cors: {
    origin: "*"
  }
});

connectDB();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/', (req, res) => {
  res.redirect('/index.html');
});

app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);

// Track connected users and their socket ids
const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('⚡ A user connected');

  socket.on('joinRoom', async (userId) => {
    socket.join(userId);
    onlineUsers.set(userId, socket.id);

    try {
      await User.findByIdAndUpdate(userId, { isOnline: true });
      io.emit("user-status-change", { userId, isOnline: true });
    } catch (err) {
      console.error("Error updating online status:", err);
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
        content,
      });
      const saved = await message.save();

      await User.findByIdAndUpdate(senderUser._id, {
        $addToSet: { recentChats: receiverUser._id },
      });
      await User.findByIdAndUpdate(receiverUser._id, {
        $addToSet: { recentChats: senderUser._id },
      });

      const populatedMsg = await Message.findById(saved._id)
        .populate("sender", "username")
        .populate("receiver", "username");

      io.to(senderUser._id.toString()).emit("receive-message", populatedMsg);
      io.to(receiverUser._id.toString()).emit("receive-message", populatedMsg);

      // Notify both users to update their recent chat list immediately
      io.to(senderUser._id.toString()).emit("recent-chat-updated", {
        contact: receiverUser.username,
        lastMessage: content
      });

      io.to(receiverUser._id.toString()).emit("recent-chat-updated", {
        contact: senderUser.username,
        lastMessage: content
      });

    } catch (err) {
      console.error("Error in socket send-message:", err);
    }
  });

  socket.on('disconnect', async () => {
    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
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
        break;
      }
    }

    console.log('❌ A user disconnected');
  });
});

app.get('/test', (req, res) => {
  res.json("Server is running");
});

server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
