// Import Firebase Authentication
import { auth } from "./firebase-config.js";
import { signInWithEmailAndPassword } from "firebase/auth";

// Handle form submission for login
document.getElementById("loginForm").addEventListener("submit", function(event) {
    event.preventDefault(); // Prevent page reload

    // Get email and password from form inputs
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    // Authenticate with Firebase
    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            // Successful login
            const user = userCredential.user;
            alert(`Welcome back, ${user.email}!`);
            console.log("User Data:", user);

            // Redirect to dashboard or user-specific page
            window.location.href = "/dashboard";
        })
        .catch((error) => {
            // Handle login errors
            console.error("Error:", error);
            switch (error.code) {
                case "auth/wrong-password":
                    alert("Incorrect password. Please try again.");
                    break;
                case "auth/user-not-found":
                    alert("No account found for this email.");
                    break;
                default:
                    alert(`Login failed: ${error.message}`);
            }
        });
});