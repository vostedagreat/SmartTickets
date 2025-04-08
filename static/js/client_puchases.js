// Simulated database fetch (replace with Data from Firebase)
document.addEventListener("DOMContentLoaded", function () {
    const events = [
        {
            type: "upcoming",
            image: "gala.jpg",
            title: "USIU GALA Night",
            date: "Friday, 18 September",
            time: "6:00pm - 10:00pm GMT +3"
        },
        {
            type: "past",
            image: "black_history.jpg",
            title: "Black History Month Talk",
            date: "Friday, 21 February",
            time: "10:00am - 5:00pm GMT +3"
        },
        {
            type: "past",
            image: "culture_night.jpg",
            title: "USIU Culture Night",
            date: "Friday, 28 March",
            time: "6:00pm - 12:00am GMT +3"
        }
    ];

    const upcomingContainer = document.getElementById("upcoming-events");
    const pastContainer = document.getElementById("past-events");

    events.forEach(event => {
        const eventCard = `
    <div class="event-card">
        <img src="${event.image}" alt="${event.title}">
            <div class="event-info">
                <h3 id=event-title>${event.title}</h3>
                <p><strong>${event.date}</strong></p>
                <p>${event.time}</p>
            </div>
            <div class="event-links">
                <a href="#" class="code">CODE</a>
            </div>
    </div>
    `;

        if (event.type === "upcoming") {
            upcomingContainer.innerHTML += eventCard;
        } else {
            pastContainer.innerHTML += eventCard;
        }
    });
});