import { firebaseConfig } from "/static/js/firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Logout function
async function handleLogout() {
    try {
        const response = await fetch('/logout', {
            method: 'GET',
            credentials: 'same-origin'
        });

        if (response.ok || response.redirected) {
            window.location.href = '/login';
        } else {
            throw new Error('Logout failed');
        }
    } catch (error) {
        console.error('Logout error:', error);
    }
}

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
                  <div class="text-center px-4 sm:px-10 py-12 max-w-3xl mx-auto">
                    <h1 class="text-4xl sm:text-6xl font-extrabold text-white leading-tight drop-shadow">
                      ${featuredEvent.eventName}
                    </h1>
                    <div>
                        <a href="/event_details?id=${featuredId}" 
                            class="mt-6 inline-block bg-pink-600 hover:bg-pink-700 text-white font-semibold px-6 py-3 rounded-full shadow transition duration-300">
                            Get Ticket
                        </a>
                    </div>
                  </div>
                `;
            } else {
                headerContent.innerHTML = `
                  <div class="text-center px-4 sm:px-10 py-12 max-w-2xl mx-auto">
                    <h1 class="text-4xl sm:text-6xl font-extrabold text-white leading-tight drop-shadow">
                      No Events Found
                    </h1>
                    <p class="mt-6 text-lg sm:text-xl text-gray-300">
                      Please check back later!
                    </p>
                    <button disabled 
                            class="mt-6 bg-pink-400 text-white font-medium px-6 py-3 rounded-full opacity-70 cursor-not-allowed">
                      Unavailable
                    </button>
                  </div>
                `;
            }
        } catch (error) {
            console.error("Error fetching featured event:", error);
        }
    }

    // Add event listener for logout
    const logoutItem = profileMenu.querySelector("li:last-child");
    logoutItem.addEventListener("click", handleLogout);

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
              <div class="flex flex-col h-full">
                <img src="${data.imageUrl}" alt="${data.eventName}" class="w-full h-48 object-cover rounded-md mb-4">
                <div class="flex-1">
                  <h3 class="text-xl font-semibold text-gray-800 mb-2 line-clamp-1">${data.eventName}</h3>
                  <p class="text-gray-600 text-sm mb-2 line-clamp-2">${data.description || 'No description available.'}</p>
                </div>
                <div class="mt-auto pt-2 border-t text-sm text-gray-700 font-medium">
                  📍 ${data.location || 'Unknown Location'}<br>
                  📅 ${data.date} | 🕒 ${data.startTime} - ${data.endTime}
                </div>
              </div>
            `;


                    // Click event to navigate to details
                    eventCard.addEventListener("click", () => {
                        window.location.href = `/event_details?id=${eventId}`;
                    });

                    eventsContainer.appendChild(eventCard);
                }
            });
        } catch (error) {
            console.error("Error fetching events:", error);
        }
    }

    // Search event filtering
    searchLocation.addEventListener("change", () => {
        fetchFilteredEvents(searchLocation.value, searchDate.value);
    });

    searchDate.addEventListener("change", () => {
        fetchFilteredEvents(searchLocation.value, searchDate.value);
    });

    await fetchFeaturedEvent();
    await fetchFilteredEvents();
});