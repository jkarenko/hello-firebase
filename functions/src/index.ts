import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

export * from "./greetings";
export * from "./dice";

export const helloWorld = onRequest((request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});
