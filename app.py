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
import base64
from datetime import datetime

# Initialize Firebase
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)

# Set up Firestore client
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

app = Flask(__name__, static_folder="static", template_folder="templates")

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
    try:
        print("[INFO] Generating QR code...")
        qr = qrcode.make(data)
        img_bytes = io.BytesIO()
        qr.save(img_bytes, format="PNG")
        img_bytes.seek(0)
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
    print(f"[INFO] Preparing to send email to {recipient}...")
    msg = EmailMessage()
    msg["From"] = GMAIL_USER
    msg["To"] = recipient
    msg["Subject"] = subject
    msg.set_content(body)
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


def get_mpesa_access_token():
    url = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
    consumer_key = os.getenv("MPESA_CONSUMER_KEY")
    consumer_secret = os.getenv("MPESA_CONSUMER_SECRET")
    response = requests.get(url, auth=(consumer_key, consumer_secret))
    return response.json()["access_token"]


@app.route("/stk_push", methods=["POST"])
def stk_push():
    try:
        data = request.get_json()
        phone = data.get("phone")
        amount = data.get("amount", 10)

        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        business_short_code = os.getenv("MPESA_SHORTCODE")
        passkey = os.getenv("MPESA_PASSKEY")
        password = base64.b64encode(f"{business_short_code}{passkey}{timestamp}".encode()).decode("utf-8")

        headers = {
            "Authorization": f"Bearer {get_mpesa_access_token()}",
            "Content-Type": "application/json"
        }

        payload = {
            "BusinessShortCode": business_short_code,
            "Password": password,
            "Timestamp": timestamp,
            "TransactionType": "CustomerPayBillOnline",
            "Amount": amount,
            "PartyA": phone,
            "PartyB": business_short_code,
            "PhoneNumber": phone,
            "CallBackURL": os.getenv("MPESA_CALLBACK_URL"),
            "AccountReference": "SmartTickets",
            "TransactionDesc": "Ticket Purchase"
        }

        response = requests.post(
            "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
            headers=headers,
            json=payload
        )

        return jsonify(response.json())

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/mpesa-callback", methods=["POST"])
def mpesa_callback():
    try:
        mpesa_data = request.get_json()
        print("[INFO] M-Pesa Callback Received:", json.dumps(mpesa_data, indent=2))

        if mpesa_data["Body"]["stkCallback"]["ResultCode"] == 0:
            metadata = mpesa_data["Body"]["stkCallback"]["CallbackMetadata"]["Item"]
            phone = None
            amount = None

            for item in metadata:
                if item["Name"] == "PhoneNumber":
                    phone = str(item["Value"])
                if item["Name"] == "Amount":
                    amount = item["Value"]

            if phone:
                print(f"[INFO] Payment received from {phone} for KES {amount}")
                ticket_info = {
                    "event": "Smart Event",
                    "amount": amount,
                    "phone": phone
                }

                qr_url = generate_qr_code(json.dumps(ticket_info))
                fake_email = f"{phone}@smarttickets.app"
                send_email(fake_email, "Your Ticket", "Thanks for your payment", qr_url)

        return jsonify({"ResultCode": 0, "ResultDesc": "Accepted"})

    except Exception as e:
        print(f"[ERROR] in /mpesa-callback: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/signup", methods=["GET", "POST"])
def signup():
    if request.method == "POST":
        try:
            if request.is_json:
                data = request.get_json()
            else:
                data = request.form.to_dict()
            email = data.get("email")
            first_name = data.get("first_name")
            last_name = data.get("last_name")
            degree = data.get("degree")
            role = data.get("role")
            phone = data.get("phone")
            password = data.get("password")

            if not email or not password:
                return jsonify({"error": "Missing required fields"}), 400

            user = auth.create_user(
                email=email,
                password=password,
                display_name=f"{first_name} {last_name}"
            )

            db.collection("users").document(user.uid).set({
                "first_name": first_name,
                "last_name": last_name,
                "email": email,
                "degree": degree,
                "role": role,
                "phone": phone,
            })

            return jsonify({"message": "Signup successful"}), 201
        except Exception as e:
            return jsonify({"error": str(e)}), 400
    elif request.method == "GET":
        return render_template("signup.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    try:
        if request.method == "GET":
            return render_template("login.html")
        elif request.method == "POST":
            data = request.get_json()
            email = data["email"]
            password = data["password"]

            user = auth.get_user_by_email(email)
            user_doc = db.collection("users").document(user.uid).get()
            if user_doc.exists:
                user_role = user_doc.to_dict().get("role")
                if user_role == "student":
                    return jsonify({"message": "Login successful", "redirect": "/client_dashboard"}), 200
                elif user_role == "staff":
                    return jsonify({"message": "Login successful", "redirect": "/admin_dashboard"}), 200
                else:
                    return jsonify({"error": "Role not recognized"}), 400
            else:
                return jsonify({"error": "User not found in Firestore"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/get_user_role", methods=["POST"])
def get_user_role():
    try:
        data = request.get_json()
        uid = data["uid"]
        user_doc = db.collection("users").document(uid).get()
        if user_doc.exists:
            user_data = user_doc.to_dict()
            return jsonify({"role": user_data.get("role")}), 200
        else:
            return jsonify({"error": "User not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/index")
def index():
    return render_template('index.html')


@app.route("/send_qr", methods=["POST"])
def send_qr():
    try:
        data = request.get_json()
        user_email = data.get("email")
        ticket_info = data.get("ticket_info")

        if not user_email or not ticket_info:
            return jsonify({"error": "Missing email or ticket_info"}), 400

        ticket_data = {
            "user_email": user_email,
            "ticket_info": ticket_info
        }
        ticket_json = json.dumps(ticket_data)
        qr_url = generate_qr_code(ticket_json)

        if not qr_url:
            return jsonify({"error": "QR code generation failed"}), 500

        if send_email(user_email, "Your Event Ticket",
                      "Here is your event ticket with QR code.",
                      qr_url):
            return jsonify({
                "message": "QR code with ticket info sent successfully!"
            })
        else:
            return jsonify({"error": "Failed to send email"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/', methods=['GET', 'POST'])
def home():
    return render_template('login.html')


@app.route('/admin_dashboard', methods=['GET', 'POST'])
def admin_dashboard():
    return render_template('admin_dashboard.html')


@app.route('/admin_checkin', methods=['GET', 'POST'])
def admin_checkin():
    return render_template('admin_checkin.html')


@app.route('/admin_feedback', methods=['GET', 'POST'])
def admin_feedback():
    return render_template('admin_feedback.html')


@app.route('/client_dashboard', methods=['GET', 'POST'])
def client_dashboard():
    return render_template('client_dashboard.html')


@app.route('/profile', methods=['GET', 'POST'])
def profile():
    return render_template('profile.html')


@app.route('/client_purchases', methods=['GET', 'POST'])
def client_purchases():
    return render_template('client_purchases.html')


if __name__ == "__main__":
    print("[INFO] Starting Flask application...")
    app.run(host="0.0.0.0", port=8080, debug=False)
