let currentEditingUser = null;
function getUserData() {
    let data = JSON.parse(localStorage.getItem("liveUser"));
    currentEditingUser = data.username;
    return data;
}

function saveUserData(data) {
    localStorage.setItem(`liveUser`, JSON.stringify(data));
}

function closeProfileModal() {
    document.getElementById("profileModal").close();
    currentEditingUser = null;
}

function enterEditMode() {
    const userData = getUserData(currentEditingUser);

    document.getElementById("picUrlInput").value = userData.profilePic || "";
    document.getElementById("bioEdit").value = userData.bio || "";

    document.getElementById("bioViewMode").style.display = "none";
    document.getElementById("bioEditMode").style.display = "block";
}

function cancelEdit() {
    document.getElementById("bioViewMode").style.display = "block";
    document.getElementById("bioEditMode").style.display = "none";
    document.getElementById("bioViewMode").classList.remove("editing");
}

async function updateProfile() {
    if (!currentEditingUser) return;

    const newBio = document.getElementById("bioEdit").value.trim();
    const newPicUrl = document.getElementById("picUrlInput").value.trim();
    alert(newBio, newPicUrl)
    try {
        const res = await fetch(`/api/users/update/${currentEditingUser}`, {
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            method: "PUT",
            body: JSON.stringify({ bio: newBio, profilePic: newPicUrl }),
        });
    } catch (error) {
        alert(error.message);
        return;
    }

    const userData = getUserData(currentEditingUser);
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
        currentEditingUser
    )}&background=random&color=fff&size=32`;
    userData.bio = newBio || "No bio available";
    if (newPicUrl) {
        userData.profilePic = newPicUrl;
    } else {
        userData.profilePic = avatarUrl;
    }

    saveUserData(userData);

    document.getElementById("profilePreview").src = userData.profilePic;
    document.getElementById("bioDisplay").textContent = userData.bio;

    const userElements = document.querySelectorAll(
        `[data-username="${currentEditingUser}"] .profile-pic`
    );
    userElements.forEach((img) => {
        img.src = userData.profilePic;
    });

    cancelEdit();
}

function triggerFileUpload() {
    document.getElementById("fileInput").click();
}

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = async function (e) {
            const dataUrl = e.target.result;
            document.getElementById("picUrlInput").value = dataUrl;
            document.getElementById("profilePreview").src = dataUrl;
            try {
                const formData = new FormData();
                formData.append("file", file)
                const res = await fetch(`/api/users/upload`, {
                    headers: { Authorization: `Bearer ${token}` },
                    method: "PUT",
                    body: formData,
                });
                // console.log(await res.json());
                const data = await res.json();
                document.getElementById("picUrlInput").value = data.file.fileUrl;
                document.getElementById("profilePreview").src = data.file.fileUrl;


            } catch (error) {
                alert(error.message);
                return;
            }
        };
        reader.readAsDataURL(file);
    }
}
