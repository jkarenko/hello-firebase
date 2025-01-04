import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {getStorage} from "firebase-admin/storage";
import {initializeApp, cert} from "firebase-admin/app";
import {verifyToken} from "./auth";

// Initialize Firebase Admin with service account key
const serviceAccount = require("../service-account-key.json");
initializeApp({
  credential: cert(serviceAccount),
  storageBucket: "jkarenko-hello-firebase.firebasestorage.app",
});

const storage = getStorage();
const bucket = storage.bucket();

interface SongVersion {
  id: string;
  displayName: string;
  filename: string;
}

interface Song {
  id: string;
  name: string;
  versions: SongVersion[];
}

// Helper function to verify auth token from request
async function verifyAuth(request: any) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("No token provided");
  }
  const token = authHeader.split("Bearer ")[1];
  return await verifyToken(token);
}

export const getSongVersions = onRequest(
  {
    cors: true,
    region: "us-central1",
  },
  async (request, response) => {
    logger.info("getSongVersions called", {
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });

    try {
      // Verify authentication
      const decodedToken = await verifyAuth(request);
      logger.info("User authenticated", {uid: decodedToken.uid});

      // List all files in the songs directory
      logger.debug("Fetching files from storage", {
        prefix: "audio/",
      });
      const [files] = await bucket.getFiles({
        prefix: "audio/",
      });

      // Group files by project and song
      const songs: Song[] = [];
      const projectVersions = new Map<string, SongVersion[]>();

      logger.debug(`Found ${files.length} files in storage`);

      for (const file of files) {
        // Skip non-mp3 files
        if (!file.name.endsWith(".mp3")) {
          continue;
        }

        // Get the project name and filename
        const parts = file.name.split("/");
        if (parts.length !== 3) {
          // Skip if not in format audio/project/file.mp3
          continue;
        }

        const projectName = parts[1];
        const filename = parts[2];

        // Get metadata from the file
        const [metadata] = await file.getMetadata();
        logger.debug("Processing file", {
          projectName,
          filename,
          metadata: metadata.metadata,
        });

        // Initialize versions array for this project if needed
        if (!projectVersions.has(projectName)) {
          projectVersions.set(projectName, []);
        }

        projectVersions.get(projectName)!.push({
          id: metadata.metadata?.id || filename,
          displayName: metadata.metadata?.displayName || filename.replace(/^[^_]*_/, "").replace(".mp3", ""),
          filename: filename,
        });
      }

      // Convert projects map to songs array
      for (const [projectName, versions] of projectVersions) {
        songs.push({
          id: projectName,
          name: projectName.charAt(0).toUpperCase() + projectName.slice(1), // Capitalize first letter
          versions: versions.sort((a, b) => a.displayName.localeCompare(b.displayName)),
        });
      }

      logger.info("Successfully fetched song versions", {
        songCount: songs.length,
        versionCount: projectVersions.size,
        user: decodedToken.uid,
      });

      response.json({songs});
    } catch (error: unknown) {
      if (error instanceof Error && (error.message === "No token provided" || error.message === "Unauthorized")) {
        logger.warn("Unauthorized access attempt", {ip: request.ip});
        response.status(401).json({error: "Unauthorized"});
      } else {
        logger.error("Error fetching song versions:", error, {
          stack: error instanceof Error ? error.stack : undefined,
        });
        response.status(500).json({error: "Internal server error"});
      }
    }
  }
);

export const getAudioUrl = onRequest(
  {
    cors: ["*"],
    region: "us-central1",
  },
  async (request, response) => {
    const filename = request.query.filename as string;
    const projectId = request.query.projectId as string;
    logger.info("getAudioUrl called", {
      filename,
      projectId,
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });

    try {
      // Verify authentication
      const decodedToken = await verifyAuth(request);
      logger.info("User authenticated", {uid: decodedToken.uid});

      if (!filename || !projectId) {
        logger.warn("Missing required parameters");
        response.status(400).json({error: "Filename and projectId are required"});
        return;
      }

      // Construct the full path
      const filePath = `audio/${projectId}/${filename}`;
      const file = bucket.file(filePath);

      logger.debug("Checking file existence", {filePath});
      const [exists] = await file.exists();

      if (!exists) {
        logger.error(`File not found: ${filePath}`);
        response.status(404).json({error: "File not found"});
        return;
      }

      try {
        // Get file metadata to get the ETag
        const [metadata] = await file.getMetadata();

        let url;
        // Use environment variable or default to Firebase Storage URL
        const storageHost = process.env.FIREBASE_APP_STORAGE || "storage.googleapis.com";

        if (process.env.FUNCTIONS_EMULATOR === "true") {
          // In emulator, return a direct URL
          url = `http://${storageHost}/storage/v1/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media`;
          logger.debug("Generated emulator URL", {url});
        } else {
          // In production, return a signed URL
          [url] = await file.getSignedUrl({
            version: "v4",
            action: "read",
            expires: Date.now() + 60 * 60 * 1000, // 1 hour
          });
          logger.debug("Generated signed URL", {url});
        }

        logger.info("Successfully generated URL", {
          filename,
          projectId,
          user: decodedToken.uid,
          isEmulator: process.env.FUNCTIONS_EMULATOR === "true",
        });

        response.json({
          url,
          etag: metadata.etag, // Include the ETag in the response
        });
      } catch (signError) {
        logger.error("Error generating signed URL:", signError, {
          filename,
          projectId,
          stack: signError instanceof Error ? signError.stack : undefined,
        });
        throw signError;
      }
    } catch (error: unknown) {
      if (error instanceof Error && (error.message === "No token provided" || error.message === "Unauthorized")) {
        logger.warn("Unauthorized access attempt", {
          ip: request.ip,
          filename,
          projectId,
        });
        response.status(401).json({error: "Unauthorized"});
      } else {
        logger.error("Error generating URL:", error, {
          filename,
          projectId,
          stack: error instanceof Error ? error.stack : undefined,
        });
        response.status(500).json({error: "Internal server error"});
      }
    }
  }
);
