import config from "./config";
import { GenerateMessageOptions } from "./types";
import { fetchDiscussionOptions, fetchHistory } from "./firestore";
import { getGenerativeClient } from "./generative-client";
import { DocumentSnapshot } from "firebase-functions/v1/firestore";

/**
 * Takes a prompt, calls the llm, returns the update object (with or without candidates accordingly).
 *
 **/
export const generateChatResponse = async (
  prompt: string,
  after: DocumentSnapshot
) => {
  const ref = after.ref;
  const history = await fetchHistory(ref);

  let requestOptions: GenerateMessageOptions = {
    history,
    context: config.context,
    maxOutputTokens: config.maxOutputTokens,
    safetySettings: config.safetySettings || [],
  };

  if (config.enableDiscussionOptionOverrides) {
    const discussionOptions = await fetchDiscussionOptions(ref);
    requestOptions = { ...requestOptions, ...discussionOptions };
  }

  const discussionClient = getGenerativeClient();
  const result = await discussionClient.send(prompt, requestOptions);

  return shouldAddCandidatesField
    ? {
        [config.responseField]: result.response!,
        [config.candidatesField!]: result.candidates!,
      }
    : {
        [config.responseField]: result.response,
      };
};

const shouldAddCandidatesField =
  config.candidatesField && config.candidateCount && config.candidateCount > 1;
