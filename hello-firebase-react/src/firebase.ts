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

const HOST = window.location.hostname;
const isDevelopment = HOST === "localhost" || HOST === "127.0.0.1";
// Always use the same host for emulators as the one used to access the app
const EMULATOR_HOST = HOST;

// Redirect to echoherence.com if we're on the old domain
if (!isDevelopment && HOST.includes("jkarenko-hello-firebase")) {
  window.location.href = `https://echoherence.com${window.location.pathname}${window.location.search}${window.location.hash}`;
}

const firebaseConfig = {
  apiKey: "AIzaSyBH2W_CEsu_3srnmQPx3cm1HEQS46_gnIM",
  authDomain: isDevelopment ? `${EMULATOR_HOST}:9099` : "echoherence.com",
  projectId: "jkarenko-hello-firebase",
  storageBucket: "jkarenko-hello-firebase.firebasestorage.app",
  messagingSenderId: "380797680247",
  appId: "1:380797680247:web:8ef0365414cca9e2ace472",
  measurementId: "G-Z227CTB2VN",
};

export function initializeFirebase() {
  if (initialized) {
    return app;
  }

  app = initializeApp(firebaseConfig);
  auth = getAuth(app);

  // Add debug logging
  console.log("Firebase Auth Configuration:", {
    authDomain: firebaseConfig.authDomain,
    currentUrl: window.location.href,
    expectedRedirectUri: `${window.location.origin}/__/auth/handler`,
  });

  functions = getFunctions(app, "us-central1");
  firestore = getFirestore(app);
  storage = getStorage(app);

  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error("Error setting auth persistence:", error);
  });

  if (!isDevelopment) {
    analytics = getAnalytics(app);
  }

  if (isDevelopment) {
    console.log("🔧 Using Firebase Emulators", {
      host: EMULATOR_HOST,
      authDomain: firebaseConfig.authDomain,
      storageBucket: firebaseConfig.storageBucket,
    });
    connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`, {disableWarnings: true});
    connectFunctionsEmulator(functions, EMULATOR_HOST, 5001);
    connectFirestoreEmulator(firestore, EMULATOR_HOST, 8080);
    connectStorageEmulator(storage, EMULATOR_HOST, 9199);
  }

  initialized = true;
  return app;
}

// Simplified getters that use the initialized flag
export function getFirebaseApp() {
  if (!initialized) {
    throw new Error("Firebase not initialized");
  }
  return app;
}

export function getFirebaseAuth() {
  if (!initialized) {
    throw new Error("Firebase not initialized");
  }
  return auth;
}

export function getFirebaseFunctions() {
  if (!initialized) {
    throw new Error("Firebase not initialized");
  }
  return functions;
}

export function getFirebaseFirestore() {
  if (!initialized) {
    throw new Error("Firebase not initialized");
  }
  return firestore;
}

export function getFirebaseAnalytics() {
  if (!initialized) {
    throw new Error("Firebase not initialized");
  }
  return analytics;
}

export function getFirebaseStorage() {
  if (!initialized) {
    throw new Error("Firebase not initialized");
  }
  return storage;
}

export {getAuth} from "firebase/auth";
