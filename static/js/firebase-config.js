// firebase-config.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth"; // Import additional Firebase services if needed

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBpsaqC7sFedmAcdB27f2rvAEDFwb7YVP8",
  authDomain: "smarttickets-d72da.firebaseapp.com",
  projectId: "smarttickets-d72da",
  storageBucket: "smarttickets-d72da.firebasestorage.app",
  messagingSenderId: "578609974714",
  appId: "1:578609974714:web:10dbac64a3378c322ba183"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app); // Include Authentication services
export { auth };