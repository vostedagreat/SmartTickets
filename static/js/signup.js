// Import Firebase Authentication
import { auth } from "./firebase-config.js";
import { createUserWithEmailAndPassword } from "firebase/auth";

document.getElementById("signupForm").addEventListener("submit", function(event) {
    event.preventDefault(); // Prevent page reload

    // Retrieve form data
    const firstName = document.getElementById("first_name").value;
    const lastName = document.getElementById("last_name").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirm_password").value;

    // Verify passwords match
    if (password !== confirmPassword) {
        alert("Passwords do not match. Please try again.");
        return;
    }

    // Register user with Firebase Authentication
    createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            const user = userCredential.user;

            // Optionally set user's display name (combine first and last name)
            user.updateProfile({
                displayName: `${firstName} ${lastName}`
            }).then(() => {
                console.log(`[SUCCESS] User created: ${user.email}`);
                alert("Signup successful! You can now login.");
                window.location.href = "/login"; // Redirect to login page
            });
        })
        .catch((error) => {
            console.error("[ERROR] Signup failed:", error);
            alert(`Signup failed: ${error.message}`);
        });
});