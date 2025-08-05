const socket = io("http://localhost:3000");

const liveUser = JSON.parse(localStorage.getItem("liveUser"));
const token = localStorage.getItem("token");

if (!liveUser || !token || !liveUser.username || !liveUser._id) {
    alert("User not logged in!");
    window.location.href = "/index.html";
}

const settingsBtn = document.getElementById("settingsBtn");

settingsBtn.addEventListener("click", () => {
    logoutBtn.classList.toggle("hidden");
});

document.getElementById("logoutBtn")?.addEventListener("click", () => {
    socket.emit("user-away", {
        userId: liveUser._id,
        lastSeen: new Date().toISOString(),
    });
    socket.disconnect();

    localStorage.removeItem("token");
    localStorage.removeItem("liveUser");
    localStorage.removeItem("selectedChatUser");
    localStorage.removeItem("user_dimple");

    window.location.href = "/index.html";
});

socket.emit("joinRoom", liveUser._id);

const userList = document.getElementById("userList");
const chatWith = document.getElementById("chatWith");
const userStatus = document.getElementById("userStatus");
const chatMessages = document.getElementById("chatMessages");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const searchInput = document.querySelector('.search-bar input');

let selectedUserUsername = null;
let selectedUserId = null;
let recentChats = [];
const onlineStatus = new Map();
const lastSeenMap = new Map();
const unreadCountMap = new Map();
let seenMessagesSet = new Set();

let originalRecentUsers = [];
let originalSuggestedUsers = [];
let currentSuggestedUsers = [];

localStorage.removeItem("selectedUser");

// --- Visibility / Unload / Tab switch detection ---
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
        socket.emit("user-away", {
            userId: liveUser._id,
            lastSeen: new Date().toISOString(),
        });
    } else if (document.visibilityState === "visible") {
        socket.emit("user-back", liveUser._id);
    }
});

window.addEventListener("beforeunload", () => {
    socket.emit("user-away", {
        userId: liveUser._id,
        lastSeen: new Date().toISOString(),
    });
    socket.disconnect();
});

// ---------------------------------------------
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
        userStatus.textContent = "Offline";
    }

    try {
        const res = await fetch(`/api/users/find/${username}`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        const user = await res.json();
        selectedUserId = user._id;

        await fetch(`/api/messages/mark-read/${selectedUserId}/${liveUser._id}`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}` }
        });

        const updatedCounts = await fetchUnreadCounts();
        updateUnreadUI(updatedCounts);

        socket.emit("messages-seen", {
            senderId: selectedUserId,
            receiverId: liveUser._id,
        });

        await fetchMessages(username);
        socket.emit("mark-seen", {
            senderId: selectedUserId,
            receiverId: liveUser._id
        });
        socket.emit("chatOpened", {
            viewerId: liveUser._id,
            chattingWithId: selectedUserId
        });

        await updateSeenMarker();

    } catch (err) {
        console.error("Failed to mark messages as read:", err);
    }

    unreadCountMap.set(username, 0);
    renderUserSidebar(recentChats, currentSuggestedUsers);
}

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

        usersData.users.forEach(user => {
            onlineStatus.set(user.username, user.isOnline);
            lastSeenMap.set(user.username, user.lastSeen || user.updatedAt);
        });

        const recent = fetchedChats.filter(u => u !== liveUser.username);
        const suggested = usersData.users
            .map(u => u.username)
            .filter(u => u !== liveUser.username && !recent.includes(u));

        recentChats = recent;

        originalRecentUsers = [...recent];
        originalSuggestedUsers = [...suggested];
        currentSuggestedUsers = [...suggested];

        renderUserSidebar(recent, suggested);

    } catch (err) {
        console.error("Error fetching chat users:", err);
    }
}

async function fetchUnreadCounts() {
    try {
        const res = await fetch(`/api/messages/unread-counts/${liveUser.username}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Unread count fetch failed");
        return await res.json();
    } catch (err) {
        console.error("Unread count error:", err.message);
        return {};
    }
}

function updateUnreadUI(counts) {
    unreadCountMap.clear();
    for (const [senderUsername, count] of Object.entries(counts)) {
        unreadCountMap.set(senderUsername, count);
    }
    updateUnreadBadges();
}

function updateUnreadBadges() {
    const userDivs = document.querySelectorAll("#userList .user");
    userDivs.forEach(div => {
        const username = div.dataset.username;
        const badge = div.querySelector(".badge");
        const count = unreadCountMap.get(username) || 0;
        badge.textContent = count;
        badge.style.display = count > 0 ? "inline-block" : "none";
    });
}

function renderUserSidebar(recentArr, suggestedArr) {
    const searchInput = document.getElementById("userSearch");
    const searchValue = searchInput.value.trim().toLowerCase();

    userList.innerHTML = ""; // Clear old sidebar

    // Preserve originals only once
    // if (!window.originalRecentUsers) {
    //     window.originalRecentUsers = [...recentArr];
    // }
    // if (!window.originalSuggestedUsers) {
    //     window.originalSuggestedUsers = [...suggestedArr];
    // }

    const rendered = new Set();

    // Filter and render Recent Chats
    const matchingRecent = recentArr.filter(u =>
        u.toLowerCase().includes(searchValue)
    );

    if (matchingRecent.length) {
        const h = document.createElement("h3");
        h.textContent = "Recent Chats";
        userList.appendChild(h);

        matchingRecent.forEach(username => {
            if (!rendered.has(username)) {
                renderUser(username);
                rendered.add(username);
            }
        });
    }

    // Filter and render Suggested Accounts
    const matchingSuggested = suggestedArr.filter(u =>
        !rendered.has(u) && u.toLowerCase().includes(searchValue)
    );

    if (matchingSuggested.length) {
        const h = document.createElement("h3");
        h.textContent = "Suggested Accounts";
        userList.appendChild(h);

        matchingSuggested.forEach(username => {
            if (!rendered.has(username)) {
                renderUser(username);
                rendered.add(username);
            }
        });
    }

    updateUnreadBadges();
}




/* search input */
searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();

    if (query === "") {
        renderUserSidebar(recentChats, currentSuggestedUsers);
        return;
    }

    // Always filter from original arrays when searching
    const filteredRecent = originalRecentUsers.filter(username =>
        username.toLowerCase().includes(query)
    );

    const filteredSuggested = originalSuggestedUsers.filter(username =>
        username.toLowerCase().includes(query) && 
        !recentChats.includes(username)
    );

    renderUserSidebar(filteredRecent, filteredSuggested);
});






function getSuggestedUsers() {
    return Array.from(lastSeenMap.keys()).filter(
        u => u !== liveUser.username && !recentChats.includes(u)
    );
}

function renderUser(username) {
    const containerDiv = document.createElement("div");
    containerDiv.style.display = "flex";
    containerDiv.style.alignItems = "center";

    const profileButton = document.createElement("button");
    profileButton.classList.add("profile-button");

    const profilePic = document.createElement("img");
    profilePic.classList.add("profile-pic");
    profilePic.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
        username
    )}&background=random&color=fff&size=32`;
    profilePic.alt = `${username}'s profile picture`;
    profilePic.onerror = function () {
        this.src =
            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%23ccc'/%3E%3Ctext x='16' y='20' text-anchor='middle' fill='white' font-family='Arial' font-size='14'%3E" +
            username.charAt(0).toUpperCase() +
            "%3C/text%3E%3C/svg%3E";
    };

    profileButton.appendChild(profilePic);
    profileButton.addEventListener("click", (e) => {
        e.stopPropagation();
        openProfileModal(username);
    });

    const userDiv = document.createElement("div");
    userDiv.classList.add("user");
    userDiv.dataset.username = username;

    const nameSpan = document.createElement("span");
    nameSpan.textContent = username;

    const badgeSpan = document.createElement("span");
    badgeSpan.classList.add("badge");
    const unreadCount = unreadCountMap.get(username) || 0;
    badgeSpan.textContent = unreadCount;
    badgeSpan.style.display = unreadCount > 0 ? "inline-block" : "none";

    userDiv.appendChild(nameSpan);
    userDiv.appendChild(badgeSpan);

    userDiv.addEventListener("click", () => {
        unreadCountMap.set(username, 0);
        handleUserClick(username);
    });

    containerDiv.appendChild(profileButton);
    containerDiv.appendChild(userDiv);

    userList.appendChild(containerDiv);
}

async function fetchMessages(receiverUsername) {
    try {
        const res = await fetch(`/api/messages/${liveUser.username}/${receiverUsername}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const messages = await res.json();
        chatMessages.innerHTML = "";
        // console.log(messages);
        

        const groupMessage = messages.reduce( (acc, current) => {
            const date = new Date(current.createdAt)
            const key = date.toLocaleDateString() || 'default';
            if(acc[key]) {
                acc[key] = [...acc[key], current]
            }else{
                acc[key] = [current]
            }
            return acc;
        }, {})
        console.log(groupMessage);
        

        seenMessagesSet.clear();

        messages.forEach(msg => {
            const isSender = msg.sender.username === liveUser.username;
            appendMessage(msg, isSender);
            if (isSender && msg.isRead) {
                seenMessagesSet.add(msg._id);
            }
        });

        updateSeenMarker();
        chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch (err) {
        console.error("Error fetching messages:", err);
    }
}

// Modify your message submit handler like this:
messageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selectedUserUsername) return alert("Select a user");

    const content = messageInput.value.trim();
    if (!content) return;

    const message = {
        sender: liveUser.username,
        receiver: selectedUserUsername,
        content,
    };

    socket.emit("send-message", message);

    messageInput.value = "";
    appendMessage({
        sender: { username: liveUser.username },
        receiver: { username: selectedUserUsername },
        content,
        createdAt: new Date().toISOString(),
    }, true);

    // Update recent chats
    if (!recentChats.includes(selectedUserUsername)) {
        recentChats.unshift(selectedUserUsername);
        // Remove from suggested if it was there
        currentSuggestedUsers = currentSuggestedUsers.filter(u => u !== selectedUserUsername);
    } else {
        recentChats = [selectedUserUsername, ...recentChats.filter(u => u !== selectedUserUsername)];
    }

    // Keep original suggested users minus any that moved to recent
    renderUserSidebar(recentChats, currentSuggestedUsers);
});

// Modify your getSuggestedUsers function to maintain original suggestions:
function getSuggestedUsers() {
    // Start with original suggested users
    const suggested = [...originalSuggestedUsers];
    
    // Filter out any that are now in recent chats
    return suggested.filter(u => 
        u !== liveUser.username && 
        !recentChats.includes(u)
    );
}



function appendMessage(message, isSender) {
    const div = document.createElement("div");
    div.classList.add("message", isSender ? "sent" : "received");
    div.innerText = message.content;

    if (isSender) {
        div.dataset.messageId = message._id || "";
        const seenSpan = document.createElement("span");
        seenSpan.classList.add("seen-indicator");

        if (seenMessagesSet.has(message._id)) {
            seenSpan.innerText = "✔✔";
            seenSpan.style.color = "blue";
        } else if (selectedUserId && onlineStatus.get(selectedUserUsername)) {
            seenSpan.innerText = "✔✔";
            seenSpan.style.color = "gray";
        } else {
            seenSpan.innerText = "✔";
            seenSpan.style.color = "gray";
        }

        div.appendChild(seenSpan);
    }

    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function updateSeenMarker() {
    const allSent = document.querySelectorAll(".message.sent");

    allSent.forEach(div => {
        const id = div.dataset.messageId;
        const seen = div.querySelector(".seen-indicator");
        if (!seen || !id) return;

        if (seenMessagesSet.has(id)) {
            seen.innerText = "✔✔";
            seen.style.color = "blue";
        }
    });
}

socket.on("message-seen", ({ readMessageIds, by }) => {
    if (!readMessageIds || by !== selectedUserId) return;

    const allSent = document.querySelectorAll(".message.sent");

    allSent.forEach(div => {
        const msgId = div.dataset.messageId;
        const seen = div.querySelector(".seen-indicator");

        if (!seen || !msgId) return;

        if (readMessageIds.includes(msgId)) {
            seenMessagesSet.add(msgId);
            seen.innerText = "✔✔";
            seen.style.color = "blue";
        }
        appendMessage(message, isSender);
    });
});

socket.on("update-message-status", ({ senderId }) => {
    const allSent = document.querySelectorAll(".message.sent");

    allSent.forEach(div => {
        const seen = div.querySelector(".seen-indicator");
        if (!seen) return;

        if (seen.style.color !== "blue") {
            seen.innerText = "✔✔";
            seen.style.color = "gray";
        }
    });
});

socket.on("receive-message", (message) => {
    const senderUsername = message.sender.username;

    if (senderUsername === liveUser.username) return;

    if (senderUsername === selectedUserUsername) {
        appendMessage(message, false);

        socket.emit("messages-seen", {
            senderId: selectedUserId,
            receiverId: liveUser._id,
        });

        setTimeout(() => {
            updateSeenMarker();
        }, 50);

    } else {
        const count = unreadCountMap.get(senderUsername) || 0;
        unreadCountMap.set(senderUsername, count + 1);
    }

    if (!recentChats.includes(senderUsername)) {
        recentChats.unshift(senderUsername);
    } else {
        recentChats = [senderUsername, ...recentChats.filter(u => u !== senderUsername)];
    }

    if (selectedUserId && message.sender._id === selectedUserId) {
        socket.emit("mark-seen", {
            senderId: selectedUserId,
            receiverId: liveUser._id
        });
    }

    renderUserSidebar(recentChats, currentSuggestedUsers);
});



socket.on("chat-seen", ({ seenBy, seenMessageIds }) => {
    if (!seenBy || !seenMessageIds) return;

    seenMessageIds.forEach(id => seenMessagesSet.add(id));
    updateSeenMarker();

    // Keep internal state consistent
    currentSuggestedUsers = getSuggestedUsers();
    renderUserSidebar(recentChats, currentSuggestedUsers);
});




socket.on("user-status-change", ({ username, isOnline, lastSeen }) => {
    onlineStatus.set(username, isOnline);
    lastSeenMap.set(username, lastSeen);

    if (username === selectedUserUsername) {
        updateUserStatusUI(isOnline, lastSeen);
    }

    // Update suggested users on status change
    currentSuggestedUsers = getSuggestedUsers();
    renderUserSidebar(recentChats, currentSuggestedUsers);
});


window.addEventListener("DOMContentLoaded", async () => {
    const counts = await fetchUnreadCounts();
    for (const [senderUsername, count] of Object.entries(counts)) {
        unreadCountMap.set(senderUsername, count);
    }

    await fetchRecentChats();

    // const previouslySelected = localStorage.getItem("selectedChatUser");
    // if (previouslySelected && previouslySelected !== liveUser.username) {
    //     handleUserClick(previouslySelected);
    // }
});
