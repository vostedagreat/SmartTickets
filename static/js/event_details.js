import { firebaseConfig } from "/static/js/firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-auth.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Extract event ID from URL
const urlParams = new URLSearchParams(window.location.search);
const eventId = urlParams.get("id");

// Button navigation to payment page
window.payForEvent = async function payForEvent() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const uid = user.uid;

            try {
                // Get user phone number
                const userDocRef = doc(db, "users", uid);
                const userSnap = await getDoc(userDocRef);

                if (!userSnap.exists()) {
                    alert("User data not found.");
                    return;
                }

                const phone = userSnap.data().phone;
                let formattedPhone = phone;
                if (phone.startsWith("0")) {
                    formattedPhone = "254" + phone.substring(1);
                }

                // Get event price
                const eventDocRef = doc(db, "events", eventId);
                const eventSnap = await getDoc(eventDocRef);

                if (!eventSnap.exists()) {
                    alert("Event not found.");
                    return;
                }

                const eventData = eventSnap.data();
                const price = eventData.price;

                console.log("Event price:", price);
                console.log("User phone number:", formattedPhone);
                console.log("User ID:", uid);
                console.log("Event ID:", eventId);

                // Send payment request to Flask
                const response = await fetch('/initiate_payment', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        phone: formattedPhone,
                        amount: price,
                        eventId: eventId
                    })
                });

                const result = await response.json();
                alert(result.message || "Payment request sent!");
            } catch (err) {
                console.error("Error during payment:", err);
                alert("Something went wrong during payment.");
            }
        } else {
            alert("Please log in first.");
        }
    });
}

// Load Event Details
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
                    <div>
                        <p class="text-sm text-gray-500">Event Name</p>
                        <h1 class="text-3xl font-bold text-gray-800 mb-2">${data.eventName}</h1>
                        
                        <img src="${data.imageUrl}" alt="${data.eventName}" id="event-image" >

                        <p class="text-sm text-gray-500">Event Description</p>
                        <p class="text-lg text-gray-700 mb-4">${data.description}</p>
                        <p class="mt-2 text-gray-600">${data.location} | ${data.date} | ${data.startTime} - ${data.endTime}</p>
                    </div>
                `;
        // Set event price
        const priceElement = document.getElementById("event-price");
        priceElement.textContent = `Ksh ${data.price}`;
    } else {
        document.getElementById("event-info").innerHTML = "<p>Event not found.</p>";
    }
}

loadEventDetails();