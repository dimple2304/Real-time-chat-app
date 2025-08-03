const socket = io("http://localhost:3000");

const liveUser = JSON.parse(localStorage.getItem("liveUser"));
const token = localStorage.getItem("token");

if (!liveUser || !token || !liveUser.username || !liveUser._id) {
    alert("User not logged in!");
    window.location.href = "/index.html";
}

socket.emit("joinRoom", liveUser._id);

const userList = document.getElementById("userList");
const chatWith = document.getElementById("chatWith");
const userStatus = document.getElementById("userStatus");
const chatMessages = document.getElementById("chatMessages");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");

let selectedUserUsername = null;
let recentChats = [];
const onlineStatus = new Map();
const lastSeenMap = new Map();
const unreadCountMap = new Map();

// --- Handle User Click ---
async function handleUserClick(username) {
    if (username === liveUser.username) return;

    selectedUserUsername = username;
    localStorage.setItem("selectedChatUser", username);
    chatWith.textContent = username;

    try {
        const res = await fetch(`/api/users/status/${username}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const { isOnline, lastSeen } = await res.json();
        updateUserStatusUI(isOnline, lastSeen);
    } catch (err) {
        console.error("Status fetch failed:", err);
        userStatus.textContent = "Offline";
    }

    await fetchMessages(username);

    try {
        const res = await fetch(`/api/users/find/${username}`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("User not found or server error");
        const selectedUser = await res.json();

        await fetch(`/api/messages/mark-read/${selectedUser._id}/${liveUser._id}`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}` }
        });

        const updatedCounts = await fetchUnreadCounts();
        updateUnreadUI(updatedCounts);

    } catch (err) {
        console.error("Failed to mark messages as read:", err);
    }

    unreadCountMap.set(username, 0);
    renderUserSidebar(recentChats, getSuggestedUsers());
}

// --- Update Online/Offline Status ---
function updateUserStatusUI(isOnline, lastSeen) {
    if (isOnline) {
        userStatus.textContent = "Online";
    } else if (lastSeen) {
        const time = new Date(lastSeen).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
        userStatus.textContent = `last seen at ${time}`;
    } else {
        userStatus.textContent = "Offline";
    }
}

// --- Fetch Recent Chats ---
async function fetchRecentChats() {
    try {
        const res = await fetch(`/api/messages/chats/${liveUser.username}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        const fetchedChats = data.chats.map(chat => chat.contact);

        const usersRes = await fetch(`/api/users/${liveUser.username}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const usersData = await usersRes.json();
        const allUsers = usersData.users.map(u => u.username);

        usersData.users.forEach(user => {
            onlineStatus.set(user.username, user.isOnline);
            lastSeenMap.set(user.username, user.updatedAt);
        });

        const recent = fetchedChats.filter(u => u !== liveUser.username);
        const suggested = allUsers.filter(u => u !== liveUser.username && !recent.includes(u));

        recentChats = recent;
        renderUserSidebar(recent, suggested);

    } catch (err) {
        console.error("Error fetching chat users:", err);
    }
}

// --- Fetch Unread Counts ---
async function fetchUnreadCounts() {
    try {
        const res = await fetch(`/api/messages/unread-counts/${liveUser.username}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (!res.ok) throw new Error("Failed to fetch unread counts");
        const data = await res.json();
        return data;
    } catch (err) {
        console.error("Unread count error:", err.message);
        return {};
    }
}

// --- Update Unread Count Map + Trigger Badge Refresh ---
function updateUnreadUI(counts) {
    unreadCountMap.clear();
    for (const [senderUsername, count] of Object.entries(counts)) {
        unreadCountMap.set(senderUsername, count);
    }
    updateUnreadBadges();
}

// --- Update Unread Badges (UI only) ---
function updateUnreadBadges() {
    const userDivs = document.querySelectorAll("#userList .user");
    userDivs.forEach(div => {
        const username = div.dataset.username;
        const badge = div.querySelector(".badge");
        const count = unreadCountMap.get(username) || 0;
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = "inline-block";
        } else {
            badge.textContent = "";
            badge.style.display = "none";
        }
    });
}

// --- Render Sidebar ---
function renderUserSidebar(recentArr, suggestedArr) {
    userList.innerHTML = "";
    const rendered = new Set();

    if (recentArr.length > 0) {
        const recentHeader = document.createElement("h3");
        recentHeader.textContent = "Recent Chats";
        userList.appendChild(recentHeader);

        recentArr.forEach(username => {
            if (!rendered.has(username)) {
                renderUser(username);
                rendered.add(username);
            }
        });
    }

    if (suggestedArr.length > 0) {
        const suggestHeader = document.createElement("h3");
        suggestHeader.textContent = "Suggested Accounts";
        userList.appendChild(suggestHeader);

        suggestedArr.forEach(username => {
            if (!rendered.has(username)) {
                renderUser(username);
                rendered.add(username);
            }
        });
    }

    // ✅ Fix: ensure badges reflect actual unreadCountMap
    updateUnreadBadges();
}

function getSuggestedUsers() {
    return Array.from(lastSeenMap.keys()).filter(
        u => u !== liveUser.username && !recentChats.includes(u)
    );
}

// --- Render Individual User ---
function renderUser(username) {
    const userDiv = document.createElement("div");
    userDiv.classList.add("user");
    userDiv.dataset.username = username;

    const nameSpan = document.createElement("span");
    nameSpan.textContent = username;

    const badgeSpan = document.createElement("span");
    badgeSpan.classList.add("badge");
    const unreadCount = unreadCountMap.get(username) || 0;
    if (unreadCount > 0) {
        badgeSpan.textContent = unreadCount;
        badgeSpan.style.display = "inline-block";
    } else {
        badgeSpan.style.display = "none";
    }

    userDiv.appendChild(nameSpan);
    userDiv.appendChild(badgeSpan);

    userDiv.addEventListener("click", () => {
        unreadCountMap.set(username, 0);
        handleUserClick(username);
    });

    userList.appendChild(userDiv);
}

// --- Fetch Messages ---
async function fetchMessages(receiverUsername) {
    try {
        const res = await fetch(`/api/messages/${liveUser.username}/${receiverUsername}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const messages = await res.json();
        chatMessages.innerHTML = "";

        messages.forEach(msg => {
            const div = document.createElement("div");
            div.classList.add("message", msg.sender.username === liveUser.username ? "sent" : "received");
            div.innerText = msg.content;
            chatMessages.appendChild(div);
        });

        chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch (err) {
        console.error("Error fetching messages:", err);
    }
}

// --- Send Message ---
messageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selectedUserUsername) return alert("Please select a user to chat with.");

    const content = messageInput.value.trim();
    if (!content) return;

    if (selectedUserUsername === liveUser.username) {
        return alert("You cannot chat with yourself.");
    }

    const message = {
        sender: liveUser.username,
        receiver: selectedUserUsername,
        content,
    };

    socket.emit("send-message", message);

    appendMessage({
        sender: { username: liveUser.username },
        receiver: { username: selectedUserUsername },
        content,
        createdAt: new Date().toISOString(),
    }, true);

    if (!recentChats.includes(selectedUserUsername)) {
        recentChats.unshift(selectedUserUsername);
    } else {
        recentChats = [selectedUserUsername, ...recentChats.filter(u => u !== selectedUserUsername)];
    }

    renderUserSidebar(recentChats, getSuggestedUsers());
    messageInput.value = "";
});

// --- Append Message ---
function appendMessage(message, isSender) {
    const div = document.createElement("div");
    div.classList.add("message", isSender ? "sent" : "received");
    div.innerText = message.content;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// --- Real-Time: Receive Message ---
socket.on("receive-message", (message) => {
    const senderUsername = message.sender.username;

    if (senderUsername === liveUser.username) return;

    if (senderUsername === selectedUserUsername) {
        appendMessage(message, false);
    } else {
        const count = unreadCountMap.get(senderUsername) || 0;
        unreadCountMap.set(senderUsername, count + 1);
    }

    if (!recentChats.includes(senderUsername)) {
        recentChats.unshift(senderUsername);
    } else {
        recentChats = [senderUsername, ...recentChats.filter(u => u !== senderUsername)];
    }

    renderUserSidebar(recentChats, getSuggestedUsers());
});

// --- Real-Time: Online Status Update ---
socket.on("user-status-change", ({ username, isOnline, lastSeen }) => {
    onlineStatus.set(username, isOnline);
    lastSeenMap.set(username, lastSeen);

    if (username === selectedUserUsername) {
        updateUserStatusUI(isOnline, lastSeen);
    }
});

// --- Initial Load ---
window.addEventListener("DOMContentLoaded", async () => {
    const counts = await fetchUnreadCounts();
    for (const [senderUsername, count] of Object.entries(counts)) {
        unreadCountMap.set(senderUsername, count);
    }

    await fetchRecentChats();

    const previouslySelected = localStorage.getItem("selectedChatUser");
    if (previouslySelected && previouslySelected !== liveUser.username) {
        handleUserClick(previouslySelected);
    }
});
