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
                  <a href="/event_details/${featuredId}" class="mt-4 inline-block bg-pink-500 px-6 py-2 text-white rounded-full">Get Ticket</a>
                `;
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
                  `;

                    eventCard.addEventListener("click", () => {
                        window.location.href = `/event_details?id=${doc.id}`;
                    });

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

// Profile menu toggle
document.getElementById('profile-img').addEventListener('click', function () {
    const menu = document.getElementById('profile-menu');
    menu.classList.toggle('hidden');
});

// Close menu when clicking outside
document.addEventListener('click', function (event) {
    const profileImg = document.getElementById('profile-img');
    const profileMenu = document.getElementById('profile-menu');

    if (!profileImg.contains(event.target) && !profileMenu.contains(event.target)) {
        profileMenu.classList.add('hidden');
    }
});