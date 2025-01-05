import {initializeApp, cert} from "firebase-admin/app";

// Initialize Firebase Admin with service account key
const serviceAccount = require("../service-account-key.json");

// Always use the production bucket name - the emulator will intercept requests automatically
const storageBucket = "jkarenko-hello-firebase.firebasestorage.app";

initializeApp({
  credential: cert(serviceAccount),
  storageBucket,
});

// Export all functions
export * from "./player";
export * from "./auth";
export * from "./projects";
