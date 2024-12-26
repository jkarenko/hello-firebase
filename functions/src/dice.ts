import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

export const rollDice = onRequest((request, response) => {
  // Get dice parameters from path: /roll/3d6 or /roll/1d20
  const dicePattern = request.path.split("/").filter(Boolean).pop() || "";

  // Add special handling for advantage/disadvantage
  if (dicePattern === "advantagecheck" || dicePattern === "disadvantagecheck") {
    // Roll 2d20 for advantage/disadvantage
    const rolls = [Math.floor(Math.random() * 20) + 1, Math.floor(Math.random() * 20) + 1];

    const result = dicePattern === "advantagecheck" ? Math.max(...rolls) : Math.min(...rolls);

    logger.info(`Rolling 2d20 with ${dicePattern}`, {
      rolls,
      result,
      structuredData: true,
    });

    response.json({
      dice: dicePattern,
      rolls,
      sum: result,
    });
    return;
  } else if (dicePattern === "normalcheck") {
    // Handle normal d20 roll
    const roll = Math.floor(Math.random() * 20) + 1;

    logger.info(`Rolling 1d20 normal`, {
      rolls: [roll],
      sum: roll,
      structuredData: true,
    });

    response.json({
      dice: "1d20",
      rolls: [roll],
      sum: roll,
    });
    return;
  }

  const match = dicePattern.toLowerCase().match(/^(\d+)d(\d+)$/);

  if (!match) {
    response.status(400).send("Invalid dice format. Please use format: {number}d{sides} (e.g., 3d6, 1d20)");
    return;
  }

  const numberOfDice = parseInt(match[1]);
  const numberOfSides = parseInt(match[2]);

  // Validate input
  if (numberOfDice <= 0 || numberOfDice > 100) {
    response.status(400).send("Number of dice must be between 1 and 100");
    return;
  }

  if (numberOfSides <= 1 || numberOfSides > 100) {
    response.status(400).send("Number of sides must be between 2 and 100");
    return;
  }

  // Roll the dice
  const rolls: number[] = [];
  for (let i = 0; i < numberOfDice; i++) {
    rolls.push(Math.floor(Math.random() * numberOfSides) + 1);
  }

  const sum = rolls.reduce((a, b) => a + b, 0);

  logger.info(`Rolling ${numberOfDice}d${numberOfSides}`, {
    rolls,
    sum,
    structuredData: true,
  });

  response.json({
    dice: `${numberOfDice}d${numberOfSides}`,
    rolls,
    sum,
  });
});
