import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

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
  (request, response) => {
    try {
      // In production, this would ideally come from Firebase Storage or Firestore
      // For now, we'll hardcode the versions we saw in player.html
      const vesipaakaupunkiVersions: SongVersion[] = [
        {id: "engl", displayName: "Engl", filename: "Compassionfruitcake_Engl.mp3"},
        {id: "elmwood", displayName: "Elmwood", filename: "Compassionfruitcake_Elmwood.mp3"},
        {id: "6505plus", displayName: "6505+", filename: "Compassionfruitcake_6505p.mp3"},
        {id: "valveking", displayName: "Valve King", filename: "Compassionfruitcake_ValveKing.mp3"},
        {id: "englcrunch", displayName: "Engl Crunch", filename: "Compassionfruitcake_Engl_Crunch.mp3"},
        {id: "rectifier", displayName: "Rectifier", filename: "Compassionfruitcake_MRecto.mp3"},
        {id: "tonexrecto", displayName: "Tonex Recto", filename: "Compassionfruitcake_TRecto.mp3"},
        {id: "tonexherbert", displayName: "Tonex Herbert", filename: "Compassionfruitcake_THerbert.mp3"},
        {id: "helixpanama_new", displayName: "Helix Panama (New)", filename: "Compassionfruitcake_HPanama_New.mp3"},
        {id: "helixpanama", displayName: "Helix Panama", filename: "Compassionfruitcake_HPanama.mp3"},
        {id: "helixrectifier", displayName: "Helix Rectifier", filename: "Compassionfruitcake_HRectifier.mp3"},
        {id: "helixmk4", displayName: "Helix Mesa MK4", filename: "Compassionfruitcake_HMK4.mp3"},
      ];

      const songs: Song[] = [
        {
          id: "vesipaakaupunki",
          name: "Vesipääkaupunki",
          versions: vesipaakaupunkiVersions,
        },
      ];

      logger.info("Fetching song versions", {
        songCount: songs.length,
        versionCount: vesipaakaupunkiVersions.length,
        structuredData: true,
      });

      response.json({songs});
    } catch (error) {
      logger.error("Error fetching song versions:", error);
      response.status(500).json({error: "Internal server error"});
    }
  }
);
