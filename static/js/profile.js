import { firebaseConfig } from "/static/js/firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-auth.js";

//Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

document.addEventListener("DOMContentLoaded", function () {
    const fullNameElement = document.querySelector(".profile-card h2:nth-of-type(1) + p");
    const emailElement = document.querySelector(".profile-card h2:nth-of-type(2) + p");
    const phoneElement = document.querySelector(".profile-card h2:nth-of-type(3) + p");
    const majorElement = document.querySelector(".profile-card h2:nth-of-type(4) + p");

    const editProfileModal = document.getElementById("editProfileModal");
    const editButton = document.querySelector(".edit-button");
    const closeModal = document.getElementById("closeModal");
    const editProfileForm = document.getElementById("editProfileForm");

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                const docRef = doc(db, "users", user.uid);
                const userDoc = await getDoc(docRef);

                if (userDoc.exists()) {
                    const data = userDoc.data();
                    //Display profile data
                    fullNameElement.textContent = `${data.first_name} ${data.last_name}`;
                    emailElement.textContent = data.email;
                    phoneElement.textContent = data.phone;
                    majorElement.textContent = data.degree;

                    //Pre-fill form in the modal
                    document.getElementById("first_name").value = data.first_name || "";
                    document.getElementById("last_name").value = data.last_name || "";
                    document.getElementById("email").value = data.email || "";
                    document.getElementById("phone").value = data.phone || "";
                    document.getElementById("degree").value = data.degree || "";
                } else {
                    console.error("User profile not found!");
                }
            } catch (error) {
                console.error("Error fetching user profile:", error);
            }
        } else {
            console.log("No user is logged in.");
        }
    });

    //Open the modal
    editButton.addEventListener("click", function () {
        console.log("Edit Profile button clicked!"); //Debug log
        editProfileModal.style.display = "flex";
    });

    //Close the modal
    closeModal.addEventListener("click", function () {
        editProfileModal.style.display = "none";
    });

    //Handle form submission for editing
    editProfileForm.addEventListener("submit", async (event) => {
        event.preventDefault(); //Prevent default form submission behavior

        const firstName = document.getElementById("first_name").value;
        const lastName = document.getElementById("last_name").value;
        const email = document.getElementById("email").value;
        const phone = document.getElementById("phone").value;
        const degree = document.getElementById("degree").value;

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const docRef = doc(db, "users", user.uid);
                    await updateDoc(docRef, {
                        first_name: firstName,
                        last_name: lastName,
                        email: email,
                        phone: phone,
                        degree: degree,
                    });
                    alert("Profile updated successfully!");
                    editProfileModal.style.display = "none"; //Close the modal
                    window.location.reload(); //Reload the page to show updated details
                } catch (error) {
                    console.error("Error updating profile:", error);
                    alert("Failed to update profile. Please try again.");
                }
            }
        });
    });
});
const backButton = document.getElementById("back");
backButton.addEventListener("click", function () {
    window.location.href = "/client_dashboard";
});