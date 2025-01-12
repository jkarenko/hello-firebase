import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {getAuth} from "firebase-admin/auth";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {addProjectCollaborator} from "./projects";
import {getFirestore} from "firebase-admin/firestore";
import {processPendingInvitations} from "./projects";
import {CORS_CONFIG} from "./config";

const db = getFirestore();

// Middleware to verify Firebase ID token
export const verifyToken = async (token: string) => {
  try {
    return await getAuth().verifyIdToken(token);
  } catch (error) {
    logger.error("Error verifying token:", error);
    throw new Error("Unauthorized");
  }
};

// Function to check if user has access to audio content
export const checkAccess = onRequest(CORS_CONFIG, async (request, response) => {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      logger.warn("No auth token provided");
      response.status(401).json({error: "No token provided"});
      return;
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await verifyToken(token);

    // Check if user has required role/permissions
    const hasAccess = await checkUserAccess(decodedToken.uid);

    response.json({
      hasAccess,
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email,
      },
    });
  } catch (error) {
    logger.error("Error checking access:", error);
    response.status(401).json({error: "Unauthorized"});
  }
});

// Helper function to check user access level
async function checkUserAccess(uid: string): Promise<boolean> {
  try {
    const user = await getAuth().getUser(uid);
    // You can implement custom claims or role-based access here
    // For now, we'll just check if the user exists and is not disabled
    return user && !user.disabled;
  } catch (error) {
    logger.error("Error checking user access:", error);
    return false;
  }
}

export const addUserToWelcomeProject = onCall(CORS_CONFIG, async (request) => {
  try {
    // Ensure user is authenticated
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    // Add user to the welcome project
    await addProjectCollaborator("sample_welcome_project", request.auth.uid, "editor");

    logger.info("Added user to welcome project", {
      userId: request.auth.uid,
      userEmail: request.auth.token.email,
    });

    return {success: true};
  } catch (error) {
    logger.error("Error adding user to welcome project:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "Failed to add user to welcome project");
  }
});

export const onUserCreated = onRequest(async (request, response) => {
  try {
    const {email, uid} = request.body;

    if (!email || !uid) {
      response.status(400).send("Email and UID are required");
      return;
    }

    // Create user document
    await db.collection("users").doc(uid).set({
      uid,
      welcomed: false,
    });

    // Process any pending invitations for this user
    await processPendingInvitations(email, uid);

    response.status(200).send("User created successfully");
  } catch (error) {
    logger.error("Error in onUserCreated:", error);
    response.status(500).send("Internal server error");
  }
});
