import { db } from './firebase';
import {
  doc, getDoc, setDoc, updateDoc
} from 'firebase/firestore';

/**
 * Load user data from Firestore
 */
export async function loadUserData(userId) {
  try {
    const ref = doc(db, 'users', userId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (err) {
    console.error('Error loading user data:', err);
    return null;
  }
}

/**
 * Save user data to Firestore
 */
export async function saveUserData(userId, data) {
  try {
    const ref = doc(db, 'users', userId);
    await setDoc(ref, data, { merge: true });
  } catch (err) {
    console.error('Error saving user data:', err);
  }
}

/**
 * Save a specific field for a user
 */
export async function saveUserField(userId, field, value) {
  try {
    const ref = doc(db, 'users', userId);
    await updateDoc(ref, { [field]: value });
  } catch (err) {
    // Document might not exist yet, create it
    await saveUserData(userId, { [field]: value });
  }
}