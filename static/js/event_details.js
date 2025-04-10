import { firebaseConfig } from "/static/js/firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-app.js";
import { getFirestore, doc, getDoc, collection, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js";
import { getAuth, onAuthStateChanged  } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-auth.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Extract event ID from URL
const urlParams = new URLSearchParams(window.location.search);
const eventId = urlParams.get("id");
console.log("Event ID from URL:", eventId);

// Global variable to store event data
let eventData = null;

// Listen for authentication state changes
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Current user:", user);
        // Store the current user
        window.user = user;
        loadEventDetails();
    } else {
        console.log("No user is logged in.");
        // Handle cases where no user is logged in
    }
});

// Load Event Details
async function loadEventDetails() {
    console.log("Loading event details...");
    try {
        if (!eventId) {
            console.error("No event ID provided.");
            document.getElementById("event-info").innerHTML = "<p>No event ID provided.</p>";
            return;
        }

        const docRef = doc(db, "events", eventId);
        console.log("Fetching event document:", docRef);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            eventData = docSnap.data();  // Store event data globally
            console.log("Event data loaded:", eventData);
            document.getElementById("event-info").innerHTML = `
                <div>
                    <p class="text-sm text-gray-500">Event Name</p>
                    <h1 class="text-3xl font-bold text-gray-800 mb-2">${eventData.eventName}</h1>
                    <img src="${eventData.imageUrl}" alt="${eventData.eventName}" id="event-image">
                    <p class="text-sm text-gray-500 mt-4">Event Description</p>
                    <p class="text-lg text-gray-700 mb-4">${eventData.description}</p>
                    <p class="mt-2 text-gray-600">${eventData.location} | ${eventData.date} | ${eventData.startTime} - ${eventData.endTime}</p>
                </div>
            `;

            // Set event price
            const priceElement = document.getElementById("event-price");
            priceElement.textContent = `Ksh ${eventData.price}`;

            // Check if the user is already registered for this event
            if (window.user) {
                await checkUserRegistration();
            } else {
                console.log("User is not logged in, skipping registration check.");
            }
        } else {
            console.error("Event not found.");
            document.getElementById("event-info").innerHTML = "<p>Event not found.</p>";
        }
    } catch (err) {
        console.error("Failed to load event:", err);
        document.getElementById("event-info").innerHTML = "<p>Error loading event details.</p>";
    }
}

async function checkUserRegistration() {
    if (!window.user) {
        console.log("No user is logged in.");
        return;  // If no user is logged in, do not proceed
    }

    console.log("Checking user registration for event:", eventId);
    const registryRef = collection(db, "events", eventId, "registry");
    const registrationDocId = `${eventId}-${window.user.uid}`;
    const docRef = doc(registryRef, registrationDocId);
    const docSnap = await getDoc(docRef);

    const registerButton = document.getElementById("registerButton");
    const buttonContainer = document.getElementById("button-container");

    // Remove any existing delist button before appending new ones
    const existingDelistButton = document.getElementById("delist-button");
    if (existingDelistButton) {
        existingDelistButton.remove();
        console.log("Existing delist button removed.");
    }

    if (docSnap.exists()) {
        console.log("User is already registered.");
        // User is already registered
        registerButton.textContent = "Registered";
        registerButton.style.backgroundColor = "#555";
        registerButton.disabled = true;

        // Create and show 'Delist' button
        const delistButton = document.createElement("button");
        delistButton.textContent = "Delist";
        delistButton.style.backgroundColor = "#ff4c4c";
        delistButton.style.color = "white";
        delistButton.id = "delist-button";
        delistButton.className = "delist-btn";
        delistButton.addEventListener("click", delistUser);

        // Append 'Delist' button to the container
        buttonContainer.appendChild(delistButton);
    } else {
        console.log("User is not registered.");
        // User is not registered
        registerButton.textContent = "Register";
        registerButton.style.backgroundColor = "green";
        registerButton.disabled = false;

        // Attach event listener to the register button again
        registerButton.addEventListener("click", registerUser);
    }
}

async function delistUser() {
    console.log("Delisting user...");
    if (!window.user) return;  // Ensure the user is logged in

    const registryRef = collection(db, "events", eventId, "registry");
    const registrationDocId = `${eventId}-${window.user.uid}`;

    // Remove user from registry
    try {
        await deleteDoc(doc(registryRef, registrationDocId));
        console.log("User successfully delisted.");
    } catch (err) {
        console.error("Error delisting user:", err);
    }

    // Update button status
    const registerButton = document.getElementById("registerButton");
    registerButton.textContent = "Register";
    registerButton.style.backgroundColor = "green";
    registerButton.disabled = false;

    // Remove 'Delist' button
    const delistButton = document.getElementById("delist-button");
    if (delistButton) {
        delistButton.remove();
    }

    // Recheck registration state to ensure proper button behavior
    await checkUserRegistration();
}

async function registerUser() {
    console.log("Registering user...");
    if (!window.user) return;  // Ensure the user is logged in

    const registryRef = collection(db, "events", eventId, "registry");
    const registrationDocId = `${eventId}-${window.user.uid}`;

    // Add user to registry
    try {
        await setDoc(doc(registryRef, registrationDocId), {
            first_name: window.user.displayName.split(" ")[0],
            last_name: window.user.displayName.split(" ")[1],
            email: window.user.email,
            check_in: false,  // Initial check-in status is false
        });
        console.log("User registered successfully!");

        // Update button status
        const registerButton = document.getElementById("registerButton");
        registerButton.textContent = "Registered";
        registerButton.style.backgroundColor = "#555";
        registerButton.disabled = true;

        // Create and show 'Delist' button
        const delistButton = document.createElement("button");
        delistButton.textContent = "Delist";
        delistButton.style.backgroundColor = "#ff4c4c";
        delistButton.style.color = "white";
        delistButton.id = "delist-button";
        delistButton.className = "delist-btn";
        delistButton.addEventListener("click", delistUser);
        document.getElementById("button-container").appendChild(delistButton);
    } catch (err) {
        console.error("Error registering user:", err);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    console.log("Document loaded. Waiting for user authentication.");
});

// Button to register
window.register = async function register() {
    console.log("Register button clicked.");
    const registerButton = document.getElementById("registerButton");
    registerButton.disabled = true;
    registerButton.textContent = "Processing...";

    try {
        const user = auth.currentUser;

        if (!user) {
            alert("Please log in to register.");
            return;
        }

        const uid = user.uid;
        console.log("User UID:", uid);

        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            console.error("User not found in Firestore.");
            alert("User data not found. Please ensure your profile is set up.");
            return;
        }

        const userData = userSnap.data();
        const firstName = userData.first_name;
        const lastName = userData.last_name;
        console.log("User data fetched:", userData);

        const qrPayload = {
            uid: user.uid,
            email: user.email,
            eventId: eventId,
        };

        const qrUrl = await QRCode.toDataURL(JSON.stringify(qrPayload));
        console.log("QR code generated:", qrUrl);

        // Show modal with QR code and event details
        const qrImageElement = document.getElementById("qrImage");
        if (qrImageElement) {
            qrImageElement.src = qrUrl;
        }

        document.getElementById("modal-content").innerHTML = `
                <div class="modal-header">
                    <img id="qrImage" src="${qrUrl}" alt="QR Code" class="qr-image mb-4">
                </div>
                <div class="modal-body">
                    <h4 class="text-xl font-semibold text-gray-800 mb-2">Event: ${eventData.eventName}</h4>
                    <p class="text-sm text-gray-600 mb-1">Date: <span class="text-gray-800">${eventData.date}</span></p>
                    <p class="text-sm text-gray-600 mb-1">Venue: <span class="text-gray-800">${eventData.location}</span></p>
                    <p class="text-sm text-gray-600 mb-1">Registered by: <span class="text-gray-800">${user.email}</span></p>
                </div>
                <div class="modal-footer">
                    <button id="closeModal" class="close-btn">Close</button>
                </div>
            `;
        document.getElementById("qrModal").classList.add("show");

        // Access Firestore and save registration data
        const eventRef = doc(db, "events", eventId);
        const registryRef = collection(eventRef, "registry");

        const registrationDocId = `${eventId}-${uid}`;
        await setDoc(doc(registryRef, registrationDocId), {
            first_name: firstName,
            last_name: lastName,
            email: user.email,
            check_in: false,
        });

        console.log("Registration data saved successfully!");

        // Send the QR code to the user via the send_qr endpoint
        const qrCodeData = {
            email: user.email,
            ticket_info: {
                eventName: eventData.eventName,
                eventDate: eventData.date,
                eventLocation: eventData.location,
                qrCodeUrl: qrUrl
            }
        };

        fetch('/send_qr', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(qrCodeData)
        })
            .then(response => response.json())
            .then(data => {
                console.log('QR code sent:', data);
            })
            .catch(error => {
                console.error('Error sending QR code:', error);
            });

    } catch (err) {
        console.error("Registration error:", err);
        alert("Something went wrong. Please try again.");
    } finally {
        // Re-enable register button after process
        registerButton.disabled = false;
        registerButton.textContent = "Register";
    }
};

// Close modal and return to dashboard
window.closeModal = function () {
    document.getElementById("qrModal").classList.remove("show");
    window.location.href = "/client_dashboard"; // Redirect to dashboard (adjust URL)
};

document.getElementById("closeModal").addEventListener("click", closeModal);
document.getElementById("qrModal").addEventListener("click", function (e) {
    if (e.target === document.getElementById("qrModal")) {
        closeModal();
    }
});