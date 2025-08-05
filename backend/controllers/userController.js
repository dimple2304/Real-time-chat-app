import User from '../models/user.js';

export const getAllUsers = async (req, res) => {
  const username = req.user.username;

  try {
    const users = await User.find({ username: { $ne: username } }, 'username');
    res.json({ success: true, users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
};

export const getSuggestedUsers = async (req, res) => {
  const { username } = req.params;

  try {
    const users = await User.find({ username: { $ne: username } }, 'username');
    res.json({ success: true, users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
};

export const getRecentChats = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.user.username })
      .populate('recentChats', 'username');

    const chats = user.recentChats
      .map(u => u.username)
      .filter(username => username !== req.user.username);  // ⛔️ Remove self

    res.json({ success: true, chats: chats.map(contact => ({ contact })) });
  } catch (err) {
    console.error("Error fetching recent chats:", err);
    res.status(500).json({ success: false, message: "Could not load recent chats" });
  }
};


export const onOffStatus = async (req, res) => {
  const { username } = req.params;

  const user = await User.findOne({ username });
  if (!user) return res.status(404).json({ error: "User not found" });

  res.json({
    isOnline: user.isOnline,
    lastSeen: user.lastSeen
  });
}



export const getUserByUsername = async (req, res) => {
  try {
    const { username } = req.params;

    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    console.error('Error in getUserByUsername:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};


export const logout = async (req, res) => {
  try {
    const userId = req.user._id;

    await User.findByIdAndUpdate(userId, {
      isOnline: false,
      lastSeen: new Date()
    });

    res.status(200).json({ message: "Logout successful" });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ error: "Server error during logout" });
  }
};



export const updateProfile = async (req, res) => {
  try {
    const { bio, profilePic } = req.body;
    const username = req.params.username;

    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.bio = bio;
    user.profilePic = profilePic;
    console.log(user)
    await user.save();

    return res.json({ user });
  } catch (err) {
    console.error("Error in getUserByUsername:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};



// Controller to handle upload
export const uploadFile = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  res.status(200).json({
    message: 'File uploaded successfully',
    file: {
      originalName: req.file.originalname,
      storedName: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype,
      fileUrl:`http://localhost:3000/uploads/${req.file.filename}`
    }
  });
};


