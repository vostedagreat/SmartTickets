console.log("[DEBUG] firebase-config.js loaded.");
// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-auth.js";

import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-auth.js";

console.log("[DEBUG] signInWithEmailAndPassword function:", signInWithEmailAndPassword);

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

console.log("[DEBUG] Auth object in firebase-config.js:", auth);
