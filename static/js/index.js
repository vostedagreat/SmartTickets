document.getElementById('qrForm').addEventListener('submit', function (event) {
    event.preventDefault();

    let email = document.getElementById('email').value;
    let ticketInfo = document.getElementById('ticketInfo').value;

    if (!email || !ticketInfo) {
        document.getElementById('errorMessage').innerText = "Please fill in both fields.";
        return;
    }

    // Clear previous messages
    document.getElementById('responseMessage').innerText = '';
    document.getElementById('errorMessage').innerText = '';

    // Show loading spinner
    document.getElementById('loadingSpinner').style.display = 'block';

    // Send data to Flask backend (via AJAX)
    fetch('/send_qr', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email: email,
            ticket_info: ticketInfo
        })
    })
        .then(response => response.json())
        .then(data => {
            document.getElementById('loadingSpinner').style.display = 'none';  // Hide loading spinner

            if (data.message) {
                document.getElementById('responseMessage').innerText = data.message;
            }
        })
        .catch(error => {
            document.getElementById('loadingSpinner').style.display = 'none';  // Hide loading spinner
            document.getElementById('errorMessage').innerText = "There was an error generating the QR code. Please try again.";
        });
});