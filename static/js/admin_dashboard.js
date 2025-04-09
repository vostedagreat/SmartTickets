import { firebaseConfig } from "/static/js/firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js";

// Initialize Firebase using imported config
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener("DOMContentLoaded", async function () {
    const newEventButton = document.getElementById("new_event");
    const eventModal = document.getElementById("eventmodal");
    const closeModalButton = document.getElementById("back");
    const eventsTable = document.getElementById("eventsTable");
    let editEventId = null; //Track the event being edited

    //Fetch and display events in the table
    async function fetchEvents() {
        eventsTable.innerHTML = ""; //Clear existing rows

        try {
            const querySnapshot = await getDocs(collection(db, "events"));
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const row = document.createElement("tr");

                row.innerHTML = `
                            <td>${data.eventName}</td>
                            <td>${data.date} ${data.startTime} - ${data.endTime}</td>
                            <td>${data.location}</td>
                            <td>${data.price}</td>
                            <td>
                                <button id="editbtn" class="edit-btn" data-id="${doc.id}">Edit</button>
                                <button id="deletebtn" class="delete-btn" data-id="${doc.id}">Delete</button>
                            </td>
                        `;

                eventsTable.appendChild(row);
            });

            //Listeners for Edit and Delete buttons
            document.querySelectorAll(".edit-btn").forEach(button => {
                button.addEventListener("click", handleEditEvent);
            });

            document.querySelectorAll(".delete-btn").forEach(button => {
                button.addEventListener("click", handleDeleteEvent);
            });
        } catch (error) {
            console.error("Error fetching events:", error);
            alert("Failed to fetch events. Please try again.");
        }
    }

    //Editing events
    function handleEditEvent(event) {
        const eventId = event.target.getAttribute("data-id");

        getDoc(doc(db, "events", eventId)).then(docSnap => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                document.getElementById("event-name").value = data.eventName;
                document.getElementById("event-description").value = data.description;
                document.getElementById("loaction").value = data.location;
                document.getElementById("date").value = data.date;
                document.getElementById("price").value = data.price;
                document.getElementById("start-time").value = data.startTime;
                document.getElementById("end-time").value = data.endTime;

                editEventId = eventId; //Track the event being edited
                eventModal.style.display = "block"; //Show modal
            }
        }).catch(error => {
            console.error("Error fetching event:", error);
            alert("Failed to fetch event details for editing.");
        });
    }

    //Deleting events
    async function handleDeleteEvent(event) {
        const eventId = event.target.getAttribute("data-id");

        if (confirm("Are you sure you want to delete this event?")) {
            try {
                await deleteDoc(doc(db, "events", eventId));
                console.log("Event deleted successfully!");
                alert("Event deleted successfully!");
                await fetchEvents(); //Refresh the table
            } catch (error) {
                console.error("Error deleting event:", error);
                alert("Failed to delete event. Please try again.");
            }
        }
    }

    //Listener for Create or Update event
    document.getElementById("create-event").addEventListener("click", async function (event) {
        event.preventDefault();

        const eventName = document.getElementById("event-name").value;
        const description = document.getElementById("event-description").value;
        const location = document.getElementById("loaction").value;
        const date = document.getElementById("date").value;
        const price = document.getElementById("price").value;
        const startTime = document.getElementById("start-time").value;
        const endTime = document.getElementById("end-time").value;
        const file = document.getElementById("event-image").files[0];

        //Default placeholder image
        let imageUrl = "/static/images/default.png";

        try {
            //Upload image if a file is provided
            if (file) {
                const formData = new FormData();
                formData.append("eventImage", file);

                const response = await fetch("/upload_image", {
                    method: "POST",
                    body: formData,
                });

                const result = await response.json();
                if (response.ok) {
                    imageUrl = result.imageUrl; //Get uploaded image URL
                } else {
                    console.error("Failed to upload image:", result.error);
                    alert("Image upload failed. Default image will be used.");
                }
            }

            if (editEventId) {
                //Update existing event
                await updateDoc(doc(db, "events", editEventId), {
                    eventName: eventName,
                    description: description,
                    location: location,
                    date: date,
                    price: price,
                    startTime: startTime,
                    endTime: endTime,
                    imageUrl: imageUrl, //Add the image URL here
                });
                console.log("Event updated successfully!");
                alert("Event updated successfully!");
            } else {
                //Create new event
                const docRef = await addDoc(collection(db, "events"), {
                    eventName: eventName,
                    description: description,
                    location: location,
                    date: date,
                    price: price,
                    startTime: startTime,
                    endTime: endTime,
                    imageUrl: imageUrl, //Add the image URL here
                });
                console.log("Event added successfully with ID:", docRef.id);
                messageContainer.textContent = "Event Has been created successfully!";
                messageContainer.style.color = "green";
                messageContainer.style.display = "block";
            }

            setTimeout(() => {
                eventModal.style.display = "none"; //Close the modal
                //Hide message after 3 seconds
            }, 3000);
            await fetchEvents();

            //Refresh the table
        } catch (error) {
            console.error("Error updating/creating event:", error);
            alert("Failed to save event details.");
        }

        editEventId = null; //Reset edit tracking
    });

    //Listeners for opening and closing modal
    newEventButton.addEventListener("click", function () {
        editEventId = null; // Reset in case of a new event
        eventModal.style.display = "block";
    });

    closeModalButton.addEventListener("click", function () {
        eventModal.style.display = "none";
    });

    window.addEventListener("click", function (event) {
        if (event.target === eventModal) {
            eventModal.style.display = "none";
        }
    });

    //Fetch and display events on page load
    await fetchEvents();
});