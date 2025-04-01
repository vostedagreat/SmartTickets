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
import firebase_admin
from firebase_admin import credentials, firestore, auth

#Initialize Firebase
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)

#Set up Firestore client
db = firestore.client()
print("[INFO] Firebase Initialized successfully.")

# Load environment variables from .env file
load_dotenv()

credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
if credentials_path:
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = credentials_path
    print("[INFO] GOOGLE_APPLICATION_CREDENTIALS loaded successfully.")
else:
    raise EnvironmentError(
        "[ERROR] GOOGLE_APPLICATION_CREDENTIALS is not set.")

app = Flask(__name__)

BUCKET_NAME = "qr-code-store"
print(f"[INFO] Using Cloud Storage Bucket: {BUCKET_NAME}")

# Access Gmail credentials from environment variables
GMAIL_USER = os.getenv("GMAIL_USER")
GMAIL_PASS = os.getenv("GMAIL_PASS")
if GMAIL_USER and GMAIL_PASS:
    print("[INFO] Gmail credentials loaded successfully.")
else:
    print("[WARNING] Gmail credentials are missing or incorrect.")


def generate_qr_code(data, filename="qrcode.png"):
    """Generates a QR Code and uploads it to Cloud Storage."""
    try:
        print("[INFO] Generating QR code...")
        qr = qrcode.make(data)

        # Convert QR code to bytes
        img_bytes = io.BytesIO()
        qr.save(img_bytes, format="PNG")
        img_bytes.seek(0)

        # Upload to Cloud Storage
        print("[INFO] Uploading QR code to Cloud Storage...")
        storage_client = storage.Client()
        bucket = storage_client.bucket(BUCKET_NAME)
        blob = bucket.blob(filename)
        blob.upload_from_file(img_bytes, content_type="image/png")

        qr_url = f"https://storage.googleapis.com/{BUCKET_NAME}/{filename}"
        print(f"[SUCCESS] QR Code uploaded successfully: {qr_url}")
        return qr_url
    except Exception as e:
        print(f"[ERROR] QR Code generation failed: {e}")
        return None


def send_email(recipient, subject, body, qr_url):
    """Sends an email with a QR code attachment from Cloud Storage."""
    print(f"[INFO] Preparing to send email to {recipient}...")
    msg = EmailMessage()
    msg["From"] = GMAIL_USER
    msg["To"] = recipient
    msg["Subject"] = subject
    msg.set_content(body)

    # Attempt to download QR code from Cloud Storage
    try:
        print(f"[INFO] Downloading QR code from {qr_url}...")
        response = requests.get(qr_url)
        if response.status_code == 200:
            msg.add_attachment(response.content,
                               maintype="image",
                               subtype="png",
                               filename="ticket_qr.png")
            print("[SUCCESS] QR code attached to email.")
        else:
            print(f"[ERROR] Failed to fetch QR code: {response.status_code}")
            return False
    except Exception as e:
        print(f"[ERROR] Error downloading QR code: {e}")
        return False

    # Send Email using SMTP_SSL
    try:
        print("[INFO] Connecting to Gmail SMTP server...")
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(GMAIL_USER, GMAIL_PASS)
            server.send_message(msg)
            print(f"[SUCCESS] Email sent successfully to {recipient}.")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to send email: {e}")
        return False


@app.route("/signup", methods=["POST"])
def signup():
    try:
        data = request.get_json()
        email = data["email"]
        password = data["password"]
        first_name = data["first_name"]
        last_name = data["last_name"]

        # Create the user in Firebase Authentication
        user = auth.create_user(
            email=email,
            password=password,
            display_name=f"{first_name} {last_name}"
        )
        print(f"[SUCCESS] User created with UID: {user.uid}")

        # Store user data in Firestore
        db.collection("users").document(user.uid).set({
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
        })

        return jsonify({"message": "Signup successful"}), 201
    except Exception as e:
        print(f"[ERROR] Signup failed: {e}")
        return jsonify({"error": str(e)}), 400

@app.route("/login", methods=["POST"])
def login():
    try:
        data = request.get_json()
        email = data["email"]
        password = data["password"]

        # Authenticate the user
        user = auth.get_user_by_email(email)
        print(f"[INFO] User logged in with UID: {user.uid}")

        return jsonify({
            "message": "Login successful",
            "user": {
                "uid": user.uid,
                "email": user.email,
                "name": user.display_name
            }
        }), 200
    except firebase_admin.auth.UserNotFoundError:
        print("[ERROR] User not found.")
        return jsonify({"error": "User not found"}), 404
    except Exception as e:
        print(f"[ERROR] Login failed: {e}")
        return jsonify({"error": str(e)}), 400

@app.route("/index")
def index():
    print("[INFO] Index route accessed.")
    return render_template('index.html')


@app.route("/send_qr", methods=["POST"])
def send_qr():
    print("[INFO] /send_qr endpoint hit.")
    try:
        data = request.get_json()
        print(f"[INFO] Received request data: {data}")

        user_email = data.get("email")
        ticket_info = data.get("ticket_info")

        if not user_email or not ticket_info:
            print("[ERROR] Missing email or ticket_info in request.")
            return jsonify({"error": "Missing email or ticket_info"}), 400

        # Format the ticket info into a JSON object
        ticket_data = {
            "user_email": user_email,
            "ticket_info": ticket_info
        }
        ticket_json = json.dumps(ticket_data)

        print("[INFO] Generating QR code...")
        qr_url = generate_qr_code(ticket_json)
        if not qr_url:
            print("[ERROR] QR code generation failed.")
            return jsonify({"error": "QR code generation failed"}), 500

        print("[INFO] Sending email with QR code...")
        if send_email(user_email, "Your Event Ticket",
                      "Here is your event ticket with QR code.",
                      qr_url):
            print("[SUCCESS] QR code sent successfully.")
            return jsonify({
                "message": "QR code with ticket info sent successfully!"
            })
        else:
            print("[ERROR] Email sending failed.")
            return jsonify({"error": "Failed to send email"}), 500
    except Exception as e:
        print(f"[ERROR] Unexpected error in /send_qr: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/', methods=['GET', 'POST'])
def home():
    return render_template('login.html')

@app.route('/admin_dashboard', methods=['GET','POST'])
def admin_dashboard():
    return render_template('admin_dashboard.html')

@app.route('/admin_checkin', methods=['GET','POST'])
def admin_checkin():
    return render_template('admin_checkin.html')

@app.route('/admin_feedback', methods=['GET','POST'])
def admin_feedback():
    return render_template('admin_feedback.html')


if __name__ == "__main__":
    print("[INFO] Starting Flask application...")
    app.run(host="0.0.0.0", port=8080, debug=False)
