// Firebase config and app
import { firebaseConfig } from "/static/js/firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-auth.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// DOM references
const upcomingContainer = document.getElementById("upcoming-events");
const pastContainer = document.getElementById("past-events");

// Store registered event IDs
const registeredEventIds = [];

// Wait for Firebase Auth to detect the currently logged-in user
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        console.log("User not logged in.");
        return;
    }

    const userId = user.uid; // Get current user's UID
    const eventsCollection = collection(db, "events"); // Reference to 'events' collection

    try {
        // Get all events
        const eventsSnapshot = await getDocs(eventsCollection);

        // Loop through each event document
        for (const eventDoc of eventsSnapshot.docs) {
            const eventId = eventDoc.id;
            const registryPath = `events/${eventId}/registry`; // Path to registry subcollection
            const registryRef = collection(db, registryPath);

            try {
                // Get all documents inside the registry subcollection
                const registrySnapshot = await getDocs(registryRef);

                // Loop through each registration document
                registrySnapshot.forEach(doc => {
                    const docId = doc.id;

                    // Check if the user ID is part of the document ID
                    if (docId.includes(userId)) {
                        // Extract the event ID portion from the document ID
                        const otherPart = docId.replace(userId, '').replace('-', '').trim();

                        // Add eventId to the list if not already added
                        if (otherPart && !registeredEventIds.includes(eventId)) {
                            registeredEventIds.push(eventId);
                        }
                    }
                });

            } catch (registryErr) {
                // Skip events that don't have a registry subcollection
                console.log(`No registry found for event ${eventId}`);
                continue;
            }
        }

        // Output all events the user is registered for
        console.log("Registered Event IDs:", registeredEventIds);

        // Now fetch details for each registered event
        for (const eventId of registeredEventIds) {
            const eventRef = doc(db, "events", eventId);
            const eventSnap = await getDoc(eventRef);  // Use getDoc() instead of get()

            if (eventSnap.exists()) {
                const eventData = eventSnap.data();
                createEventCard(eventData, eventId, user.uid, user.email);  // Pass user.uid and user.email
            }
        }

    } catch (error) {
        console.error("Error fetching events:", error);
    }
});

function createEventCard(eventData, eventId, uid, email) {
    const isPastEvent = new Date(eventData.date) < new Date();
    const container = isPastEvent ? pastContainer : upcomingContainer;

    const card = document.createElement("div");
    card.className = "event-card";
    card.innerHTML = `
            <div class="event-card-container">
                <img src="${eventData.imageUrl}" alt="${eventData.eventName}" class="event-img">
                <div class="event-details">
                    <h3>${eventData.eventName}</h3>
                    <p><strong>Date:</strong> ${eventData.date}</p>
                    <p><strong>Time:</strong> ${eventData.startTime} - ${eventData.endTime}</p>
                    <p><strong>Location:</strong> ${eventData.location}</p>
                    <p><strong>Price:</strong> ${eventData.price}</p>
                    <button class="show-code-btn" data-event-id="${eventId}" data-uid="${uid}" data-email="${email}">Show Code</button>
                </div>
            </div>
        `;

    container.appendChild(card);

    // Attach event listener to the button
    const button = card.querySelector(".show-code-btn");
    button.addEventListener("click", async () => {
        const qrPayload = {
            uid,
            email,
            eventId,
        };

        const qrUrl = await QRCode.toDataURL(JSON.stringify(qrPayload));
        console.log("QR code generated:", qrUrl);

        // Populate modal
        document.getElementById("modal-content").innerHTML = `
                <div class="modal-header flex justify-between items-center mb-6">
                    <img id="qrImage" src="${qrUrl}" alt="QR Code" class="qr-image w-32 h-32 rounded-lg shadow-lg">
                </div>
                <div class="modal-footer flex justify-center mt-6">
                </div>
                `;
        document.getElementById("qrModal").classList.add("show");

        // Close modal
        document.getElementById("closeModal").addEventListener("click", () => {
            document.getElementById("qrModal").classList.remove("show");
        });
    });
}