// let currentEditingUser = null;
// function getUserData() {
//   let data = JSON.parse(localStorage.getItem("liveUser"));
//   currentEditingUser = data.username;
//   return data;
// }

// function saveUserData(username, data) {
//   localStorage.setItem(`user_${username}`, JSON.stringify(data));
// }

// function closeProfileModal() {
//   document.getElementById("profileModal").close();
//   currentEditingUser = null;
// }

// function enterEditMode() {
//   const userData = getUserData(currentEditingUser);

//   document.getElementById("picUrlInput").value = userData.profilePic || "";
//   document.getElementById("bioEdit").value = userData.bio || "";

//   document.getElementById("bioViewMode").style.display = "none";
//   document.getElementById("bioEditMode").style.display = "block";
// }

// function cancelEdit() {
//   document.getElementById("bioViewMode").style.display = "block";
//   document.getElementById("bioEditMode").style.display = "none";
//   document.getElementById("bioViewMode").classList.remove("editing");
// }

// async function updateProfile() {
//   if (!currentEditingUser) return;

//   const newBio = document.getElementById("bioEdit").value.trim();
//   const newPicUrl = document.getElementById("picUrlInput").value.trim();

//   try {
//     const res = await fetch(`/api/users/update/${currentEditingUser}`, {
//       headers: { Authorization: `Bearer ${token}` },
//       method: "POST",
//       body: JSON.stringify({ bio: newBio, profilePic: newPicUrl }),
//     });
//   } catch (error) {
//     alert(error.message);
//     return;
//   }

//   const userData = getUserData(currentEditingUser);
//   userData.bio = newBio || "No bio available";
//   if (newPicUrl) {
//     userData.profilePic = newPicUrl;
//   }

//   saveUserData(currentEditingUser, userData);

//   document.getElementById("profilePreview").src = userData.profilePic;
//   document.getElementById("bioDisplay").textContent = userData.bio;

//   const userElements = document.querySelectorAll(
//     `[data-username="${currentEditingUser}"] .profile-pic`
//   );
//   userElements.forEach((img) => {
//     img.src = userData.profilePic;
//   });

//   cancelEdit();
// }

// function triggerFileUpload() {
//   document.getElementById("fileInput").click();
// }

// function handleFileUpload(event) {
//   const file = event.target.files[0];
//   if (file) {
//     const reader = new FileReader();
//     reader.onload = function (e) {
//       const dataUrl = e.target.result;
//       document.getElementById("picUrlInput").value = dataUrl;
//       document.getElementById("profilePreview").src = dataUrl;
//     };
//     reader.readAsDataURL(file);
//   }
// }
