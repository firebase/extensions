/*
 * This template contains a HTTP function that responds with a greeting when called
 *
 * Always use the FUNCTIONS HANDLER NAMESPACE
 * when writing Cloud Functions for extensions.
 * Learn more about the handler namespace in the docs
 *
 * Reference PARAMETERS in your functions code with:
 * `process.env.<parameter-name>`
 * Learn more about parameters in the docs
 */

const functions = require('firebase-functions');
const extensions = require('firebase-admin/extensions');
const {logger} = functions;
const {getExtensions} = extensions;

exports.greetTheWorld = functions.handler.https.onRequest(async (req, res) => {
  // Here we reference a user-provided parameter (its value is provided by the user during installation)
  const consumerProvidedGreeting = process.env.GREETING;

  // And here we reference an auto-populated parameter (its value is provided by Firebase after installation)
  const instanceId = process.env.EXT_INSTANCE_ID;

  const greeting = `${consumerProvidedGreeting} World from ${instanceId}`;

  for (let i = 0; i < 15; i++) {
    logger.log(`Starting loop iteration number ${i}`);
    await new Promise(r => setTimeout(r, 1000));
  }
  logger.log("after the loop")

  res.send(greeting);
});

exports.backfillGreetTheWorld = functions.tasks
  .taskQueue()
  .onDispatch(async (data) => {
    const MAX_GENERATION = 5
    const runtime = getExtensions().runtime();

    // Here we reference a user-provided parameter (its value is provided by the user during installation)
    const consumerProvidedGreeting = process.env.GREETING;

    const generation = (data && data.generation) || 0
    // And here we reference an auto-populated parameter (its value is provided by Firebase after installation)
    const instanceId = process.env.EXT_INSTANCE_ID;

    const greeting = `${consumerProvidedGreeting} World from ${instanceId}`;

    for (let i = 0; i < 11*60; i++) {
      logger.log(`B${generation}!!: Starting loop iteration number ${i}`);
      await new Promise(r => setTimeout(r, 1000));
    }
    logger.log("Bafter the loop");
    logger.log(greeting);


    if (generation == MAX_GENERATION) {
      await runtime.setProcessingState(
        "PROCESSING_COMPLETE",
        "Bdone greeting godot"
      );

      return;
    }

    const queue = getFunctions().taskQueue(
      `locations/${config.location}/functions/backfillGreetTheWorld`,
      process.env.EXT_INSTANCE_ID
    );

    await queue.enqueue({
      generation: generation + 1,
    });
});
