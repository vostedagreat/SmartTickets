// static/js/event_detail.js
import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Extract event ID from URL
const urlParams = new URLSearchParams(window.location.search);
const eventId = urlParams.get("id");

async function loadEventDetails() {
    if (!eventId) {
        document.getElementById("event-info").innerHTML = "<p>No event ID provided.</p>";
        return;
    }

    const docRef = doc(db, "events", eventId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const data = docSnap.data();
        document.getElementById("event-info").innerHTML = `
            <h1 class="text-3xl font-bold">${data.eventName}</h1>
            <img src="${data.imageUrl}" alt="${data.eventName}" class="my-4 rounded">
            <p class="text-lg">${data.description}</p>
            <p class="mt-2 text-gray-600">${data.location} | ${data.date} | ${data.startTime} - ${data.endTime}</p>
        `;
    } else {
        document.getElementById("event-info").innerHTML = "<p>Event not found.</p>";
    }
}

loadEventDetails();
