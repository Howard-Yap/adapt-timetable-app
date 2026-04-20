import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAjvfj3h09XaMyc-HZOYitjCOmgDSGN7l4",
  authDomain: "adapt-timetable-app.firebaseapp.com",
  projectId: "adapt-timetable-app",
  storageBucket: "adapt-timetable-app.firebasestorage.app",
  messagingSenderId: "510441601351",
  appId: "1:510441601351:web:c19b1bc6c0c95d89283462",
  measurementId: "G-MXLFBDHCSS"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);