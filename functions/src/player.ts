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
        prefix: "audio/vesipaakaupunki/",
      });
      const [files] = await bucket.getFiles({
        prefix: "audio/vesipaakaupunki/",
      });

      // Group files by song
      const songs: Song[] = [];
      const versions: SongVersion[] = [];

      logger.debug(`Found ${files.length} files in storage`);

      for (const file of files) {
        // Skip the directory itself
        if (file.name.endsWith("/")) {
          continue;
        }

        // Get the filename without the path
        const filename = file.name.split("/").pop() || "";

        // Get metadata from the file
        const [metadata] = await file.getMetadata();
        logger.debug("Processing file", {
          filename,
          metadata: metadata.metadata,
        });

        versions.push({
          id: metadata.metadata?.id || filename,
          displayName:
            metadata.metadata?.displayName || filename.replace("Compassionfruitcake_", "").replace(".mp3", ""),
          filename: filename,
        });
      }

      songs.push({
        id: "vesipaakaupunki",
        name: "Vesipääkaupunki",
        versions: versions.sort((a, b) => a.displayName.localeCompare(b.displayName)),
      });

      logger.info("Successfully fetched song versions", {
        songCount: songs.length,
        versionCount: versions.length,
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
    logger.info("getAudioUrl called", {
      filename,
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });

    try {
      // Verify authentication
      const decodedToken = await verifyAuth(request);
      logger.info("User authenticated", {uid: decodedToken.uid});

      if (!filename) {
        logger.warn("Missing filename in request");
        response.status(400).json({error: "Filename is required"});
        return;
      }

      // Construct the full path
      const filePath = `audio/vesipaakaupunki/${filename}`;
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

        // Generate a signed URL that expires in 1 hour
        const [url] = await file.getSignedUrl({
          version: "v4",
          action: "read",
          expires: Date.now() + 60 * 60 * 1000, // 1 hour
        });

        logger.info("Successfully generated signed URL", {
          filename,
          user: decodedToken.uid,
        });

        response.json({
          url,
          etag: metadata.etag, // Include the ETag in the response
        });
      } catch (signError) {
        logger.error("Error generating signed URL:", signError, {
          filename,
          stack: signError instanceof Error ? signError.stack : undefined,
        });
        throw signError;
      }
    } catch (error: unknown) {
      if (error instanceof Error && (error.message === "No token provided" || error.message === "Unauthorized")) {
        logger.warn("Unauthorized access attempt", {
          ip: request.ip,
          filename,
        });
        response.status(401).json({error: "Unauthorized"});
      } else {
        logger.error("Error generating URL:", error, {
          filename,
          stack: error instanceof Error ? error.stack : undefined,
        });
        response.status(500).json({error: "Internal server error"});
      }
    }
  }
);
