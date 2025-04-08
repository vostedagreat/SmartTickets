// Navigation functions
function goToAdmin() {
    window.location.href = "/admin_dashboard";
}

function goToSignup() {
    window.location.href = "/signup";
}

// Firebase login logic
import { auth } from "/static/js/firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("loginForm");
    const submitButton = document.getElementById("login");
    const errorElement = document.createElement("div");
    errorElement.id = "login-error";
    errorElement.style.color = "red";
    errorElement.style.marginTop = "10px";
    form.appendChild(errorElement);

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        submitButton.disabled = true;
        submitButton.textContent = "Signing in...";
        errorElement.textContent = "";

        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        try {
            // 1. Authenticate with Firebase
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const idToken = await userCredential.user.getIdToken();

            // 2. Create secure session
            const sessionResponse = await fetch('/session_login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken })
            });

            if (!sessionResponse.ok) {
                const errorData = await sessionResponse.json();
                throw new Error(errorData.error || "Session creation failed");
            }

            // 3. Get user role and redirect
            const roleResponse = await fetch('/get_user_role', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: userCredential.user.uid })
            });

            if (!roleResponse.ok) throw new Error("Failed to get user role");
            
            const roleData = await roleResponse.json();
            window.location.href = roleData.role === "student" 
                ? "/client_dashboard" 
                : "/admin_dashboard";

        } catch (error) {
            console.error("Login error:", error);
            errorElement.textContent = getFriendlyErrorMessage(error);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Login Now";
        }
    });

    function getFriendlyErrorMessage(error) {
        switch (error.code) {
            case "auth/invalid-email":
                return "Please enter a valid email address";
            case "auth/user-not-found":
            case "auth/wrong-password":
                return "Invalid email or password";
            case "auth/too-many-requests":
                return "Too many attempts. Please try again later.";
            default:
                return "Login failed. Please try again.";
        }
    }
});