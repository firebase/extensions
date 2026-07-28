export interface Message {
  path?: string;
  prompt?: string;
  response?: string;
}

export interface ChatResponse {
  response: string;
  candidates: string[];
  //TODO: fix this type
  safetyMetadata?: any;
  history: Message[];
}

export abstract class DiscussionClient<
  Client,
  ChatOptions extends {
    history?: Message[];
    context?: string;
  },
  ApiMessage
> {
  client?: Client;
  constructor() {}

  private getHistory(options: ChatOptions) {
    let history: Message[] = [];

    if (options.context) {
      const contextMessage = {
        prompt: `System prompt: ${options.context}.`,
        response: "Understood.",
      };
      history = [contextMessage];
    }
    if (options.history) {
      history = [...history, ...options.history];
    }
    return history;
  }

  async send(
    messageContent: string,
    options: ChatOptions
  ): Promise<ChatResponse> {
    if (!this.client) {
      throw new Error("Client not initialized.");
    }
    const history = this.getHistory(options);
    const latestApiMessage = this.createApiMessage(messageContent);
    return await this.generateResponse(history, latestApiMessage, options);
  }

  createApiMessage(
    _messageContent: string,
    _role: "user" | "model" = "user"
  ): ApiMessage {
    throw new Error("Method Not implemented");
  }

  async generateResponse(
    _history: Message[],
    _latestApiMessage: ApiMessage,
    _options: ChatOptions
  ): Promise<ChatResponse> {
    throw new Error("Not implemented");
  }
}
