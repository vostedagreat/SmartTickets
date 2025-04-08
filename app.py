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
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = 'C:\\Users\\Sharon\\Desktop\\School\\Spring 2025\\APP4080\\SmartTickets-main\\credentials.json'


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
        return render_template("signup.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    try:
        if request.method == "GET":
            # Render the login page for a GET request
            print(
                "[INFO] GET request received on /login. Rendering login.html.")
            return render_template("login.html")

        elif request.method == "POST":
            # Extract email and password from the request
            data = request.get_json()
            email = data["email"]
            password = data["password"]

            # Authenticate the user in Firebase Authentication
            user = auth.get_user_by_email(email)
            print(f"[INFO] User authenticated with UID: {user.uid}")

            # Fetch the user role from Firestore
            user_doc = db.collection("users").document(user.uid).get()
            if user_doc.exists:
                user_role = user_doc.to_dict().get("role")
                if user_role == "student":
                    return jsonify({"message": "Login successful",
                                    "redirect": "/client_dashboard"}), 200
                elif user_role == "staff":
                    return jsonify({"message": "Login successful",
                                    "redirect": "/admin_dashboard"}), 200
                else:
                    return jsonify({"error": "Role not recognized"}), 400
            else:
                return jsonify({"error": "User not found in Firestore"}), 404
    except Exception as e:
        print(f"[ERROR] Login failed: {e}")
        return jsonify({"error": str(e)}), 400


@app.route("/get_user_role", methods=["POST"])
def get_user_role():
    try:
        # Extract UID from the request
        data = request.get_json()
        uid = data["uid"]

        # Query Firestore to fetch user role
        user_doc = db.collection("users").document(uid).get()
        if user_doc.exists:
            user_data = user_doc.to_dict()
            return jsonify({"role": user_data.get("role")}), 200
        else:
            return jsonify({"error": "User not found"}), 404
    except Exception as e:
        print(f"[ERROR] Failed to retrieve user role: {e}")
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


# Endpoint to generate a ticket for an event
@app.route('/buy_ticket/<event_id>', methods=['POST'])
def buy_ticket(event_id):
    try:
        # Fetch the user ID (you can get this from the session or request)
        user_id = request.json.get("user_id")  # This will come from frontend

        if not user_id:
            return jsonify({"error": "User ID is required"}), 400

        # Create a unique ticket ID
        ticket_id = str(uuid.uuid4())

        # Create a ticket document
        ticket_data = {
            "user_id": user_id,
            "event_id": event_id,
            "ticket_id": ticket_id,
            "purchase_date": datetime.utcnow(),
            "status": "purchased",  # Can be 'purchased', 'scanned', etc.
            "ticket_url": f"/ticket/{ticket_id}"  # URL to be encoded in QRcode
        }

        # Store the ticket in Firestore
        ticket_ref = db.collection('tickets').document(ticket_id)
        ticket_ref.set(ticket_data)

        # Respond with the ticket URL for QR code generation
        return jsonify({"ticket_url": ticket_data["ticket_url"]}), 200

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


@app.route('/event_details', methods=['GET', 'POST'])
def event_details():
    return render_template('event_details.html')


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


@app.route('/initiate_payment', methods=['GET','POST'])
def initiate_payment():
    if request.is_json:
        data = request.get_json()  # Parse the incoming JSON request
        phone = data.get('phone')
        amount = data.get('amount')
        event_id = data.get('eventId')
        # Your payment logic here
    else:
        return "Invalid content type, expected application/json", 400

    if not phone or not event_id:
        return jsonify({"success": False, "message": "Missing phone number or event ID"}), 400

    # MPESA Sandbox Credentials
    consumer_key = 'vPjNE2DDtxf31SVukwq47FhdNDhKW90iBcX2QxM53L7RE2XE'
    consumer_secret = 'kXiVnuR3Zp9eWZVnTDyTCMAGbB7Au7Iwkazrwy1f5tA7DzARY0sT8jrPvwf5qtRU'
    shortcode = '174379'
    passkey = 'bfb279f9aa9bdbcf113b1e8e1b4e23454e97f1f1d555b24c1c2b14e4f2a9da74'
    callback_url = 'https://yourdomain.com/payment_callback'  # You'll define this route later

    # Get access token
    auth_response = requests.get(
        'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
        auth=(consumer_key, consumer_secret)
    )
    access_token = auth_response.json().get('access_token')

    if not access_token:
        return jsonify({"success": False, "message": "Failed to get MPESA access token"}), 500

    # Generate timestamp and password
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    password = base64.b64encode((shortcode + passkey + timestamp).encode()).decode()

    payload = {
        "BusinessShortCode": shortcode,
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": "CustomerPayBillOnline",
        "Amount": amount,  # Adjust this dynamically if needed
        "PartyA": phone,
        "PartyB": shortcode,
        "PhoneNumber": phone,
        "CallBackURL": callback_url,
        "AccountReference": event_id,
        "TransactionDesc": f"Payment for event {event_id}"
    }

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }

    response = requests.post(
        "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
        json=payload,
        headers=headers
    )

    return jsonify(response.json())


if __name__ == "__main__":
    print("[INFO] Starting Flask application...")
    app.run(host="0.0.0.0", port=8080, debug=False)
