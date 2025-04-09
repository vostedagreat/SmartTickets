import { firebaseConfig } from "/static/js/firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener("DOMContentLoaded", async function () {
    const headerContent = document.querySelector(".header-content");
    const eventsContainer = document.querySelector(".grid");
    const searchLocation = document.querySelector(".search-location");
    const searchDate = document.querySelector(".search-date");

    const profileImg = document.getElementById("profile-img");
    const profileMenu = document.getElementById("profile-menu");

    profileMenu.style.display = "none";
    profileImg.addEventListener("click", function () {
        profileMenu.style.display = profileMenu.style.display === "none" ? "block" : "none";
    });
    document.addEventListener("click", function (event) {
        if (!profileImg.contains(event.target) && !profileMenu.contains(event.target)) {
            profileMenu.style.display = "none";
        }
    });

    async function fetchFeaturedEvent() {
        try {
            const querySnapshot = await getDocs(collection(db, "events"));
            const featuredEvent = querySnapshot.docs[0]?.data();
            const featuredId = querySnapshot.docs[0]?.id;

            if (featuredEvent) {
                headerContent.innerHTML = `
                  <h1 class="text-6xl font-bold">${featuredEvent.eventName}</h1>
                  <p class="mt-4 text-lg">${featuredEvent.description}</p>
                  <a href="javascript:void(0);" id="buy-ticket-btn" class="mt-4 inline-block bg-pink-500 px-6 py-2 text-white rounded-full">Get Ticket</a>                `;
                document.getElementById("buy-ticket-btn").addEventListener("click", () => {
                    showPhoneNumberPrompt(featuredId);
                });
            } else {
                headerContent.innerHTML = `
                  <h1 class="text-6xl font-bold">No Events Found</h1>
                  <p class="mt-4 text-lg">Please check back later!</p>
                  <button class="mt-4 bg-pink-500 px-6 py-2 text-white rounded-full disabled">Unavailable</button>
                `;
            }
        } catch (error) {
            console.error("Error fetching featured event:", error);
        }
    }

    function showPhoneNumberPrompt(featuredId) {
        const phone = prompt("Enter your phone number to purchase the ticket:");
        if (phone) {
            fetch("/initiate_payment", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ phone, event_id: featuredId })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert("Payment prompt sent to your phone. Complete the payment to receive your ticket.");
                    } else {
                        alert("Error: " + data.message);
                    }
                })
                .catch(error => {
                    console.error("Error initiating payment:", error);
                    alert("There was an error initiating the payment. Please try again.");
                });
        }
    }

    async function fetchLocations() {
        try {
            const querySnapshot = await getDocs(collection(db, "events"));
            const locationSet = new Set();

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.location) locationSet.add(data.location);
            });

            searchLocation.innerHTML = `<option value="">All Locations</option>`;
            locationSet.forEach((location) => {
                const option = document.createElement("option");
                option.value = location;
                option.textContent = location;
                searchLocation.appendChild(option);
            });
        } catch (error) {
            console.error("Error fetching locations:", error);
        }
    }

    async function fetchFilteredEvents(location = "", date = "") {
        try {
            const querySnapshot = await getDocs(collection(db, "events"));
            eventsContainer.innerHTML = "";

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const eventId = doc.id;

                if (
                    (!location || data.location === location) &&
                    (!date || data.date === date)
                ) {
                    const eventCard = document.createElement("div");
                    eventCard.className = "bg-white p-4 shadow rounded-lg cursor-pointer transition hover:shadow-lg";
                    eventCard.setAttribute("data-id", eventId);

                    eventCard.innerHTML = `
                    <img src="${data.imageUrl}" class="w-full h-48 object-cover rounded" alt="${data.eventName}">
                    <h3 class="mt-3 font-bold">${data.eventName}</h3>
                    <p class="text-sm mt-2">${data.description}</p>
                    <p class="text-sm font-semibold mt-1">${data.date} ${data.startTime} - ${data.endTime}</p>
                    <h5 class="bluetext give-feedback">Give Feedback</h5>

                    <div class="modal hidden" id="feedback_modal">
                      <div class="modal-content">
                        <h2></h2>
                        <textarea id="feedback" placeholder="Give the organizer feedback about the event"></textarea><br>
                        <button id="save_feedback" onclick="saveFeedback()">Send Feedback</button>
                        <button id="back" onclick="document.getElementById('feedback_modal').classList.add('hidden')">Back</button>
                      </div>
                    </div>
                  `;

                    // Click event to navigate to details
                    eventCard.addEventListener("click", (e) => {
                        if (!e.target.classList.contains("give-feedback")) {
                            window.location.href = `/event_details?id=${doc.id}`;
                        }
                    });

                    // Event listener for feedback modal toggle
                    setTimeout(() => {
                        const giveFeedback = eventCard.querySelector(".give-feedback");
                        const modal = eventCard.querySelector("#feedback_modal");

                        giveFeedback.addEventListener("click", (e) => {
                            e.stopPropagation();
                            const modalheader = modal.querySelector('h2')
                            modalheader.innerHTML = `Give Feedback about ${data.eventName}`;

                            modal.style.display = 'block'
                        });

                        // Prevent clicks inside modal from bubbling to eventCard
                        modal.addEventListener("click", (e) => {
                            e.stopPropagation();
                        });

                        modal.querySelector("#feedback").addEventListener("click", (e) => {
                            e.stopPropagation();
                        });

                        modal.querySelector("#save_feedback").addEventListener("click", (e) => {
                            e.stopPropagation();
                        });

                        modal.querySelector("#back").addEventListener("click", (e) => {
                            e.stopPropagation();
                            modal.classList.add('hidden');
                        });
                    }, 0);

                    eventsContainer.appendChild(eventCard);
                }
            });
        } catch (error) {
            console.error("Error fetching events:", error);
        }
    }

    searchLocation.addEventListener("change", () => {
        fetchFilteredEvents(searchLocation.value, searchDate.value);
    });

    searchDate.addEventListener("change", () => {
        fetchFilteredEvents(searchLocation.value, searchDate.value);
    });

    await fetchFeaturedEvent();
    await fetchLocations();
    await fetchFilteredEvents();
});


window.saveFeedback = async function () {
    const modal = document.querySelector(".modal:not(.hidden)");
    const feedbackText = modal?.querySelector("#feedback")?.value?.trim();
    const eventId = modal?.closest("[data-id]")?.getAttribute("data-id");
    const userId = localStorage.getItem("user_id");

    if (!feedbackText) {
        alert("Please write some feedback before saving.");
        return;
    }

    try {
        await addDoc(collection(db, "feedbacks"), {
            feedback: feedbackText,
            event_id: eventId,
            user_id: userId,
            timestamp: new Date().toISOString()
        });

        alert("Thank you for your feedback!");

        // Reset and close the modal
        modal.querySelector("#feedback").value = "";
        modal.classList.add("hidden");
    } catch (error) {
        console.error("Error saving feedback:", error);
        alert("There was an error saving your feedback. Please try again.");
    }
};