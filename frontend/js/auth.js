const showSignup = document.querySelector("#showSignup");
const showLogin = document.querySelector("#showLogin");
const signinForm = document.querySelector("#signinForm");
const loginForm = document.querySelector("#loginForm");

let signup = document.querySelector("#signup");
let register = document.querySelector("#register");
let login = document.querySelector("#login");

let newUsername = document.querySelector("#newUsername");
let newPassword = document.querySelector("#newPassword");
let newEmail = document.querySelector("#newEmail");

const otpInput = document.querySelector("#otpInput");
const otpLabel = document.querySelector("#otpLabel");
const otpError = document.querySelector("#otpError");
const otpSection = document.querySelector("#otpSection");

let username = document.querySelector("#username");
let password = document.querySelector("#password");

let loginUsernameError = document.querySelector("#loginUsernameError");
let loginPasswordError = document.querySelector("#loginPasswordError");


// Toggle Signup/Login
showSignup.addEventListener("click", () => {
    loginForm.style.display = "none";
    signinForm.style.display = "flex";
    showSignup.classList.add("active");
    showLogin.classList.remove("active");
});

showLogin.addEventListener("click", () => {
    loginForm.style.display = "flex";
    signinForm.style.display = "none";
    showSignup.classList.remove("active");
    showLogin.classList.add("active");
});

let isOtpVerified = false;

// Signup button - Generate OTP
signup.addEventListener("click", async function (e) {
    e.preventDefault();

    usernameError.innerText = "";
    emailError.innerText = "";
    passwordError.innerText = "";
    otpError.innerText = "";

    const newUsernameVal = newUsername.value.trim();
    const newEmailVal = newEmail.value.trim();
    const newPasswordVal = newPassword.value;

    let hasError = false;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!newUsernameVal) {
        usernameError.innerText = "Username is required!";
        hasError = true;
    }
    if (!newEmailVal) {
        emailError.innerText = "Email is required!";
        hasError = true;
    } else if (!emailPattern.test(newEmailVal)) {
        emailError.innerText = "Invalid email!";
        hasError = true;
    }
    if (!newPasswordVal.trim()) {
        passwordError.innerText = "Password is required!";
        hasError = true;
    } else if (newPasswordVal.length < 8) {
        passwordError.innerText = "Password must be at least 8 characters!";
        hasError = true;
    }

    if (hasError) return;

    try {
        const res = await fetch("http://localhost:3000/api/auth/send-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: newEmailVal }),
        });

        const data = await res.json();

        if (data.success) {
            swal("OTP sent!", "Check your gmail.", "success");
            otpSection.style.display = "block";
            signup.style.display = 'none';
            register.style.display = "block";
        } else {
            otpError.innerText = "Failed to send OTP!";
        }
    } catch (err) {
        otpError.innerText = "Error sending OTP.";
    }
});

// Register after OTP
register.addEventListener("click", async function (e) {
    e.preventDefault();

    otpError.innerText = "";
    const otpVal = otpInput.value.trim();
    const emailVal = newEmail.value.trim();

    try {
        const verifyRes = await fetch("http://localhost:3000/api/auth/verify-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: emailVal, otp: otpVal }),
        });

        const verifyData = await verifyRes.json();

        if (!verifyData.success) {
            otpError.innerText = "Invalid OTP!";
            return;
        }

        const signupData = {
            username: newUsername.value.trim(),
            email: emailVal,
            password: newPassword.value,
        };

        const res = await fetch("http://localhost:3000/api/auth/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(signupData),
        });

        const result = await res.json();

        if (result.success) {
            loginForm.style.display = "flex";
            signinForm.style.display = "none";
            showSignup.classList.remove("active");
            showLogin.classList.add("active");

            otpSection.style.display = "none";
            otpInput.value = "";
            register.style.display = "none";
            signup.style.display = "block";
            newUsername.value = "";
            newEmail.value = "";
            newPassword.value = "";
            otpError.innerText = "Signup successful! You can login now.";
        } else {
            otpError.innerText = result.message || "Signup failed!";
        }

    } catch (err) {
        otpError.innerText = "Error during OTP verification or signup.";
    }
});


login.addEventListener("click", async function (e) {
    e.preventDefault();

    loginUsernameError.innerText = "";
    loginPasswordError.innerText = "";

    const usernameVal = username.value.trim();
    const passwordVal = password.value;

    if (!usernameVal) {
        loginUsernameError.innerText = "Username is required!";
        return;
    }
    if (!passwordVal) {
        loginPasswordError.innerText = "Password is required!";
        return;
    }

    try {
        const loginData = {
            username: usernameVal,
            password: passwordVal,
        };

        const res = await fetch("http://localhost:3000/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(loginData)
        });
        const result = await res.json();
        console.log("Login response:", result);

        if (result.success) {
            localStorage.setItem("token", result.token);
            localStorage.setItem("liveUser", JSON.stringify(result.user)); 

            window.location.href = result.redirect;
        } else {
            loginUsernameError.innerText = result.message || "Login failed";
            alert("Login failed: " + result.message);
        }

    } catch (err) {
        loginUsernameError.innerText = "Something went wrong. Try again.";
        console.error(err);
    }
});

