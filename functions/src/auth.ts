import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {getAuth} from "firebase-admin/auth";

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
export const checkAccess = onRequest(
  {
    cors: true,
    region: "us-central1",
  },
  async (request, response) => {
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
  }
);

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
