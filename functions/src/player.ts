import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {getStorage} from "firebase-admin/storage";
import {initializeApp} from "firebase-admin/app";

// Initialize Firebase Admin if not already done
initializeApp();

const storage = getStorage();
const bucket = storage.bucket("jkarenko-hello-firebase.firebasestorage.app");

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
      });

      response.json({songs});
    } catch (error) {
      logger.error("Error fetching song versions:", error, {
        stack: (error as Error).stack,
      });
      response.status(500).json({error: "Internal server error"});
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

      // Get file metadata to use for cache validation
      logger.debug("Fetching file metadata", {filePath});
      const [metadata] = await file.getMetadata();
      const etagValue = metadata.etag;

      // Use Firebase Storage URL format with cache busting based on etag
      const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
        filePath
      )}?alt=media&cache=${etagValue}`;

      // Set cache control headers
      response.set("Access-Control-Allow-Origin", "*");
      response.set("Access-Control-Allow-Methods", "GET");
      response.set("Cache-Control", "public, max-age=300"); // Cache for 5 minutes
      response.set("ETag", etagValue);

      logger.info("Successfully generated audio URL", {
        filename,
        etag: etagValue,
      });

      response.json({
        url: publicUrl,
        cacheControl: "public, max-age=300",
        etag: etagValue,
      });
    } catch (error) {
      logger.error("Error generating URL:", error, {
        filename,
        stack: (error as Error).stack,
      });
      response.status(500).json({error: "Internal server error"});
    }
  }
);
