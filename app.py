from flask import Flask, request, jsonify, render_template
import qrcode
import smtplib
import os
import json
from email.message import EmailMessage
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

# Access Gmail credentials from environment variables
GMAIL_USER = os.getenv("GMAIL_USER")
GMAIL_PASS = os.getenv("GMAIL_PASS")

def generate_qr_code(data, filename="qrcode.png"):
    """Generates a QR Code and saves it as an image."""
    qr = qrcode.make(data)
    qr.save(filename)
    return filename

def send_email(recipient, subject, body, attachment):
    """Sends an email with an attached QR Code."""
    msg = EmailMessage()
    msg["From"] = GMAIL_USER
    msg["To"] = recipient
    msg["Subject"] = subject
    msg.set_content(body)

    # Attach QR Code Image
    with open(attachment, "rb") as img:
        msg.add_attachment(img.read(), maintype="image", subtype="png", filename=attachment)

    # Send Email
    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(GMAIL_USER, GMAIL_PASS)
        server.send_message(msg)

@app.route("/")
def index():
    return render_template('index.html')

@app.route("/send_qr", methods=["POST"])
def send_qr():
    user_email = request.json.get("email")
    ticket_info = request.json.get("ticket_info")

    if not user_email or not ticket_info:
        return jsonify({"error": "Missing email or ticket_info"}), 400

    # Format the ticket info into a JSON object
    ticket_data = {
        "user_email": user_email,
        "ticket_info": ticket_info
    }

    # Convert the ticket info to a JSON string
    ticket_json = json.dumps(ticket_data)

    qr_filename = generate_qr_code(ticket_json)
    send_email(user_email, "Your Event Ticket", "Here is your event ticket with QR code.", qr_filename)

    os.remove(qr_filename)  # Clean up generated file

    return jsonify({"message": "QR code with ticket info sent successfully!"})

if __name__ == "__main__":
    app.run(debug=True)
