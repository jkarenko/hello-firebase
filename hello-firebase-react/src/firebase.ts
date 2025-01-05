import {initializeApp, FirebaseApp} from "firebase/app";
import {getAuth, connectAuthEmulator, Auth, setPersistence, browserLocalPersistence} from "firebase/auth";
import {getFunctions, connectFunctionsEmulator, Functions} from "firebase/functions";
import {getAnalytics, Analytics} from "firebase/analytics";
import {getFirestore, connectFirestoreEmulator, Firestore} from "firebase/firestore";
import {getStorage, connectStorageEmulator} from "firebase/storage";
import type {FirebaseStorage} from "firebase/storage";

// Use a singleton pattern with a clear initialization state
let initialized = false;
let app: FirebaseApp;
let auth: Auth;
let functions: Functions;
let analytics: Analytics | null = null;
let firestore: Firestore;
let storage: FirebaseStorage;

const firebaseConfig = {
  apiKey: "AIzaSyBH2W_CEsu_3srnmQPx3cm1HEQS46_gnIM",
  authDomain: "jkarenko-hello-firebase.firebaseapp.com",
  projectId: "jkarenko-hello-firebase",
  storageBucket: "jkarenko-hello-firebase.firebasestorage.app",
  messagingSenderId: "380797680247",
  appId: "1:380797680247:web:8ef0365414cca9e2ace472",
  measurementId: "G-Z227CTB2VN",
};

const isDevelopment = window.location.hostname === "127.0.0.1";

export function initializeFirebase() {
  if (initialized) {
    return app;
  }

  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  functions = getFunctions(app);
  firestore = getFirestore(app);
  storage = getStorage(app);

  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error("Error setting auth persistence:", error);
  });

  if (!isDevelopment) {
    analytics = getAnalytics(app);
  }

  if (isDevelopment) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", {disableWarnings: true});
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
    connectFirestoreEmulator(firestore, "127.0.0.1", 8080);
    connectStorageEmulator(storage, "127.0.0.1", 9199);
  }

  initialized = true;
  return app;
}

// Simplified getters that use the initialized flag
export function getFirebaseApp() {
  if (!initialized) throw new Error("Firebase not initialized");
  return app;
}

export function getFirebaseAuth() {
  if (!initialized) throw new Error("Firebase not initialized");
  return auth;
}

export function getFirebaseFunctions() {
  if (!initialized) throw new Error("Firebase not initialized");
  return functions;
}

export function getFirebaseFirestore() {
  if (!initialized) throw new Error("Firebase not initialized");
  return firestore;
}

export function getFirebaseAnalytics() {
  return analytics;
}

export function getFirebaseStorage() {
  if (!initialized) throw new Error("Firebase not initialized");
  return storage;
}
