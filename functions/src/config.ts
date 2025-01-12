export const ALLOWED_ORIGINS = process.env.FUNCTIONS_EMULATOR
  ? true
  : [
      "https://echoherence.com",
      "https://echoherence.web.app",
      "https://echoherence.firebaseapp.com",
      "http://localhost:5000",
      "http://127.0.0.1:5000",
    ];

export const CORS_CONFIG = {
  cors: ALLOWED_ORIGINS,
  region: "us-central1",
};
