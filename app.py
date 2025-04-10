from flask import Flask, request, jsonify, render_template, redirect, make_response
from google.cloud import storage
import smtplib
import os
import json
from email.message import EmailMessage
from dotenv import load_dotenv
import qrcode
import io
from datetime import timedelta
import requests
import firebase_admin
from firebase_admin import credentials, firestore, auth
from functools import wraps
import uuid  # To generate unique ticket IDs
from datetime import datetime
import base64

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


def check_auth_session():
    """Centralized session verification"""
    session_cookie = request.cookies.get('firebase_session')
    if not session_cookie:
        return None

    try:
        decoded_token = auth.verify_session_cookie(
            session_cookie, check_revoked=True)
        user_doc = db.collection("users").document(decoded_token['uid']).get()
        return user_doc.to_dict() if user_doc.exists else None
    except (auth.InvalidSessionCookieError, auth.RevokedSessionCookieError):
        return None


def auth_required(f):
    """Decorator for protected routes"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_data = check_auth_session()
        if not user_data:
            return redirect('/login')
        return f(*args, **kwargs)
    return decorated_function


def role_required(role):
    """Decorator for role-based access"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user_data = check_auth_session()
            if not user_data or user_data.get('role') != role:
                return redirect('/login')
            return f(*args, **kwargs)
        return decorated_function
    return decorator


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


UPLOAD_FOLDER = 'static/images'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER


@app.route("/upload_image", methods=["POST"])
def upload_image():
    if "eventImage" not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    file = request.files["eventImage"]

    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    # Save the file to /static/images
    try:
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
        file.save(file_path)
        return jsonify({"message": "Image uploaded successfully",
                        "imageUrl": f"/static/images/{file.filename}"}), 200
    except Exception as e:
        return jsonify({"error": f"Failed to upload image: {str(e)}"}), 500


# Session Management
@app.route('/session_login', methods=['POST'])
def session_login():
    try:
        id_token = request.json.get('idToken')
        expires_in = timedelta(hours=1)  # Shorter session duration

        session_cookie = auth.create_session_cookie(
            id_token,
            expires_in=expires_in
        )

        response = make_response(jsonify({"status": "success"}))
        response.set_cookie(
            'firebase_session',
            session_cookie,
            max_age=expires_in.total_seconds(),
            httponly=True,
            secure=os.environ.get("FLASK_ENV") == "production",
            samesite='Lax'
        )
        return response
    except Exception as e:
        app.logger.error(f"Session login failed: {str(e)}")
        return jsonify({"error": "Authentication failed"}), 401


# Logout
@app.route('/logout')
def logout():
    response = make_response(redirect('/login'))
    response.set_cookie('firebase_session', '', expires=0)
    return response


# Role-based Authentication
@app.route('/get_user_role', methods=['POST'])
def get_user_role():
    try:
        uid = request.json.get('uid')
        user_doc = db.collection("users").document(uid).get()
        if not user_doc.exists:
            return jsonify({"error": "User not found"}), 404
        return jsonify({"role": user_doc.to_dict().get("role")}), 200
    except Exception as e:
        app.logger.error(f"Role fetch failed: {str(e)}")
        return jsonify({"error": str(e)}), 400


@app.route('/', methods=['GET', 'POST'])
def home():
    user_data = check_auth_session()
    if user_data:
        return redirect(
            "/admin_dashboard" if user_data['role'] == "staff"
            else "/client_dashboard")
    return render_template('login.html')


@app.route('/login', methods=['GET'])
def login():
    user_data = check_auth_session()
    if user_data:
        return redirect(
            "/admin_dashboard" if user_data['role'] == "staff"
            else "/client_dashboard")
    return render_template('login.html')


@app.route("/signup", methods=["GET", "POST"])
def signup():
    if request.method == "POST":
        try:
            print("[DEBUG] Received POST request on /signup.")
            # Check request type and parse data
            if request.is_json:
                print("[DEBUG] Request contains JSON.")
                data = request.get_json()
            else:
                print("[DEBUG] Request contains form data.")
                data = request.form.to_dict()

            # Log received data
            print("[DEBUG] Received data:", data)

            # Extract fields from the data
            email = data.get("email")
            first_name = data.get("first_name")
            last_name = data.get("last_name")
            degree = data.get("degree")
            role = data.get("role")
            phone = data.get("phone")
            password = data.get("password")

            # Basic validation
            if not email or not password:
                print("[ERROR] Missing required fields.")
                return jsonify({"error": "Missing required fields"}), 400

            # Create user in Firebase Authentication
            print("[DEBUG] Creating user in Firebase Authentication...")
            user = auth.create_user(
                email=email,
                password=password,
                display_name=f"{first_name} {last_name}"
            )
            print(f"[SUCCESS] User created with UID: {user.uid}")

            # Store user data in Firestore
            print("[DEBUG] Storing user data in Firestore...")
            db.collection("users").document(user.uid).set({
                "first_name": first_name,
                "last_name": last_name,
                "email": email,
                "degree": degree,
                "role": role,
                "phone": phone,
            })
            print("[SUCCESS] User data stored in Firestore.")

            return jsonify({"message": "Signup successful"}), 201
        except Exception as e:
            print(f"[ERROR] Signup failed: {e}")
            return jsonify({"error": str(e)}), 400
    elif request.method == "GET":
        print(
            "[DEBUG] GET request received on /signup. Rendering signup.html.")
        user_data = check_auth_session()
        if user_data:
            return redirect(
                "/admin_dashboard" if user_data['role'] == "staff"
                else "/client_dashboard")
        return render_template("signup.html")


# Protected Route
@app.route('/admin_dashboard', methods=['GET', 'POST'])
@role_required('staff')
def admin_dashboard():
    return render_template('admin_dashboard.html')


@app.route('/admin_checkin', methods=['GET', 'POST'])
@role_required('staff')
def admin_checkin():
    return render_template('admin_checkin.html')


@app.route('/admin_feedback', methods=['GET', 'POST'])
@role_required('staff')
def admin_feedback():
    return render_template('admin_feedback.html')


@app.route('/client_dashboard', methods=['GET', 'POST'])
@role_required('student')
def client_dashboard():
    return render_template('client_dashboard.html')


@app.route('/profile', methods=['GET', 'POST'])
@role_required('student')
def profile():
    return render_template('profile.html')


@app.route('/client_purchases', methods=['GET', 'POST'])
@role_required('student')
def client_purchases():
    return render_template('client_purchases.html')


@app.route('/event_details', methods=['GET', 'POST'])
@role_required('student')
def event_details():
    return render_template('event_details.html')


@app.route("/index")
def index():
    print("[INFO] Index route accessed.")
    return render_template('index.html')


@app.route("/send_qr", methods=["POST"])
def send_qr():
    print("[INFO] /send_qr endpoint hit.")
    try:
        data = request.get_json()
        user_email = data.get("email")
        ticket_info = data.get("ticket_info")

        if not user_email or not ticket_info:
            return jsonify({"error": "Missing email or ticket_info"}), 400

        # No need to generate QR code again, we already have it from the frontend
        qr_url = ticket_info.get("qrCodeUrl")

        if not qr_url:
            return jsonify({"error": "QR code URL is missing"}), 400

        # Send email with the provided QR code URL
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


# Endpoint to retrieve ticket details (optional, for QR code validation)
@app.route('/ticket/<ticket_id>', methods=['GET'])
def get_ticket(ticket_id):
    try:
        # Retrieve ticket from Firestore
        ticket_ref = db.collection('tickets').document(ticket_id)
        ticket = ticket_ref.get()

        if ticket.exists:
            return jsonify(ticket.to_dict()), 200
        else:
            return jsonify({"error": "Ticket not found"}), 404

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/ticketing', methods=['GET'])
def ticketing():
    return '''
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Event Ticketing</title>
    </head>
    <body>
        <h1>Event Ticketing System</h1>

        <!-- Form to Buy Ticket -->
        <section>
            <h2>Buy Ticket</h2>
            <form id="buyTicketForm">
                <label for="event_id">Event ID:</label>
                <input type="text" id="event_id" name="event_id" required><br><br>

                <label for="user_id">User ID:</label>
                <input type="text" id="user_id" name="user_id" required><br><br>

                <button type="submit">Buy Ticket</button>
            </form>
            <div id="ticketResponse"></div>
        </section>

        <!-- Form to Retrieve Ticket -->
        <section>
            <h2>Retrieve Ticket</h2>
            <form id="getTicketForm">
                <label for="ticket_id">Ticket ID:</label>
                <input type="text" id="ticket_id" name="ticket_id" required><br><br>

                <button type="submit">Get Ticket</button>
            </form>
            <div id="ticketDetails"></div>
        </section>

        <script>
            // Handle Buy Ticket Form Submission
            document.getElementById('buyTicketForm').addEventListener('submit', async function(event) {
                event.preventDefault();
                const event_id = document.getElementById('event_id').value;
                const user_id = document.getElementById('user_id').value;

                const response = await fetch(`/buy_ticket/${event_id}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ user_id: user_id })
                });

                const result = await response.json();
                const ticketResponse = document.getElementById('ticketResponse');

                if (response.ok) {
                    ticketResponse.innerHTML = `<p>Ticket purchased successfully. Access it <a href="${result.ticket_url}" target="_blank">here</a>.</p>`;
                } else {
                    ticketResponse.innerHTML = `<p>Error: ${result.error}</p>`;
                }
            });

            // Handle Get Ticket Form Submission
            document.getElementById('getTicketForm').addEventListener('submit', async function(event) {
                event.preventDefault();
                const ticket_id = document.getElementById('ticket_id').value;

                const response = await fetch(`/ticket/${ticket_id}`, {
                    method: 'GET'
                });

                const result = await response.json();
                const ticketDetails = document.getElementById('ticketDetails');

                if (response.ok) {
                    ticketDetails.innerHTML = `<p>Ticket ID: ${result.ticket_id}</p>
                                               <p>Event ID: ${result.event_id}</p>
                                               <p>User ID: ${result.user_id}</p>
                                               <p>Status: ${result.status}</p>
                                               <p>Purchase Date: ${result.purchase_date}</p>`;
                } else {
                    ticketDetails.innerHTML = `<p>Error: ${result.error}</p>`;
                }
            });
        </script>
    </body>
    </html>
    '''


@app.errorhandler(404)
def page_not_found(e):
    # Redirect all undefined routes to home page
    return redirect('/')


if __name__ == "__main__":
    print("[INFO] Starting Flask application...")
    app.run(host="0.0.0.0", port=8080, debug=False)
