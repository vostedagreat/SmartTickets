from flask import Flask, request, jsonify, render_template
from google.cloud import storage
import smtplib
import os
import json
from email.message import EmailMessage
from dotenv import load_dotenv
import qrcode
import io
import requests

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

BUCKET_NAME = "qr-code-store"

# Access Gmail credentials from environment variables
GMAIL_USER = os.getenv("GMAIL_USER")
GMAIL_PASS = os.getenv("GMAIL_PASS")

def generate_qr_code(data, filename="qrcode.png"):
    """Generates a QR Code and uploads it to Cloud Storage."""
    qr = qrcode.make(data)
    
    # Convert QR code to bytes
    img_bytes = io.BytesIO()
    qr.save(img_bytes, format="PNG")
    img_bytes.seek(0)

    # Upload to Cloud Storage
    storage_client = storage.Client()
    bucket = storage_client.bucket(BUCKET_NAME)
    blob = bucket.blob(filename)
    blob.upload_from_file(img_bytes, content_type="image/png")

    return f"https://storage.googleapis.com/{BUCKET_NAME}/{filename}"

def send_email(recipient, subject, body, qr_url):
    """Sends an email with a QR code attachment from Cloud Storage."""
    msg = EmailMessage()
    msg["From"] = GMAIL_USER
    msg["To"] = recipient
    msg["Subject"] = subject
    msg.set_content(body)

    # Download QR code from Cloud Storage
    response = requests.get(qr_url)
    if response.status_code == 200:
        msg.add_attachment(response.content, maintype="image", subtype="png", filename="qrcode.png")

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

    qr_url = generate_qr_code(ticket_json)
    print(f"Generated QR Code URL: {qr_url}")  # Debugging line
    send_email(user_email, "Your Event Ticket", "Here is your event ticket with QR code.", qr_url)

    return jsonify({"message": "QR code with ticket info sent successfully!"})

if __name__ == "__main__":
    app.run(debug=True)
