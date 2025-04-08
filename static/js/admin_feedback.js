document.addEventListener("DOMContentLoaded", function() {
    const newEventButton = document.getElementById("new_event");
    const eventModal = document.getElementById("eventmodal");
    const closeModalButton = document.getElementById("back");

    newEventButton.addEventListener("click", function() {
        console.log("add event clicked")
        eventModal.style.display = "block";
    });

    closeModalButton.addEventListener("click", function() {
        eventModal.style.display = "none";
    });

    window.addEventListener("click", function(event) {
        if (event.target === eventModal) {
            eventModal.style.display = "none";
        }
    });
});