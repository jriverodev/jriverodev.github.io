import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// IMPORTANT: Move these to environment variables in a real application
const firebaseConfig = {
  apiKey: "AIzaSyAyp6MSHLvmtdzDRVXqMU7wkRn4tWypA2I",
  authDomain: "jesus-rivero.firebaseapp.com",
  projectId: "jesus-rivero",
  storageBucket: "jesus-rivero.appspot.com",
  messagingSenderId: "74695325616",
  appId: "1:74695325616:web:c4c92ba15e1b50874d0875",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { app, db };
