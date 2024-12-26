import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

export const greet = onRequest((request, response) => {
  const pathParts = request.path.split("/").filter(Boolean);
  const name = pathParts[pathParts.length - 1];

  if (!name) {
    response.status(400).send("Please provide a name in the URL path");
    return;
  }

  switch (request.method) {
    case "GET":
      logger.info(`Greeting ${name}`, {structuredData: true});
      response.send(`Hello, ${name}!`);
      break;
    case "POST":
      const {title} = request.body;
      logger.info(`Greeting ${name} with title ${title}`, {structuredData: true});
      response.send(`Hello, ${title ? title + " " : ""}${name}!`);
      break;
    default:
      response.status(405).send("Method not allowed");
  }
});
