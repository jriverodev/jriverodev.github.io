// src/lib/firebase-server.ts
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";

// NOTE: This is a server-only file.
// It is important that this file is NOT imported into any client-side code.

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp;
const appName = "server-app";

// Initialize a new app for the server if one doesn't already exist.
if (!getApps().some(app => app.name === appName)) {
    app = initializeApp(firebaseConfig, appName);
} else {
    app = getApp(appName);
}

const db: Firestore = getFirestore(app);

export { app as serverApp, db as serverDB };
