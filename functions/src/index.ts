import {initializeApp, cert} from "firebase-admin/app";

// Initialize Firebase Admin with service account key
const serviceAccount = require("../service-account-key.json");

initializeApp({
  credential: cert(serviceAccount),
  storageBucket: "jkarenko-hello-firebase.firebasestorage.app",
});

// Export all functions
export * from "./player";
export * from "./auth";
export * from "./projects";
