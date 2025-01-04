// Initialize Firebase and export instances
let firebaseInitialized = false;

export function initializeFirebase() {
  if (firebaseInitialized) {
    console.log("Firebase already initialized");
    return window.firebase;
  }

  console.log("Initializing Firebase");
  firebaseInitialized = true;

  // Initialize Firebase for development
  const app = window.firebase.initializeApp({
    apiKey: "demo-key",
    authDomain: "127.0.0.1",
    projectId: "jkarenko-hello-firebase",
    storageBucket: "jkarenko-hello-firebase.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:123456789",
  });

  // Connect to emulators in development
  if (window.location.hostname === "127.0.0.1") {
    console.log("Connecting to Firebase emulators...");

    // Connect to emulators
    const auth = app.auth();
    auth.useEmulator("http://127.0.0.1:9099");
    console.log("Auth emulator connected");

    // Add persistent auth state listener
    auth.onAuthStateChanged((user) => {
      console.log("Global auth state changed:", {
        userId: user?.uid,
        email: user?.email,
        isAnonymous: user?.isAnonymous,
        timestamp: new Date().toISOString(),
      });
    });

    const functions = app.functions();
    functions.useEmulator("127.0.0.1", 5001);
    console.log("Functions emulator connected");

    // Set region for functions
    app.functions("us-central1");

    console.log("Connected to emulators");
  }

  return window.firebase;
}

// Add type for window.firebase
declare global {
  interface Window {
    firebase: any;
  }
}
