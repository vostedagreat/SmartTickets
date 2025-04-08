document.getElementById("signupForm").addEventListener("submit", function(event) {
    console.log("[DEBUG] Submit button clicked.");
    event.preventDefault();

    const firstName = document.getElementById("first_name").value;
    const lastName = document.getElementById("last_name").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirm_password").value;
    const degree = document.getElementById("degree").value;
    const phone = document.getElementById("phone").value;

    console.log("[DEBUG] Form data:", {
        first_name: firstName,
        last_name: lastName,
        email: email,
        password: password,
        confirm_password: confirmPassword,
        degree: degree,
        role: "Student",
        phone: phone
    });

    if (password !== confirmPassword) {
        console.log("[ERROR] Passwords do not match.");
        alert("Passwords do not match. Please try again.");
        return;
    }

    console.log("[DEBUG] Sending POST request to backend...");
    fetch("/signup", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            first_name: firstName,
            last_name: lastName,
            email: email,
            degree: degree,
            role: "Student",
            phone: phone,
            password: password
        })
    })
    .then((response) => {
        console.log("[DEBUG] Backend response received:", response);
        if (response.ok) {
            console.log("[SUCCESS] Signup successful.");
            alert("Signup successful! You can now log in.");
            window.location.href = "/login";
        } else {
            response.json().then((data) => {
                console.log("[ERROR] Backend returned error:", data);
                alert(`Signup failed: ${data.error}`);
            });
        }
    })
    .catch((error) => {
        console.error("[ERROR] Signup failed:", error);
        alert("An unexpected error occurred. Please try again.");
    });
});