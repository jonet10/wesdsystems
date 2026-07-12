export interface NotificationMessage {
  to: string;
  body: string;
  subject?: string;
  type: 'whatsapp' | 'email';
}

export interface ProviderConfig {
  apiKey?: string;
  apiUrl?: string;
  phoneNumber?: string;
  providerType?: string;
}

export abstract class NotificationProvider {
  protected config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  /**
   * Initializes the provider (e.g. authenticating, connecting to websocket).
   */
  abstract initialize(): Promise<void>;

  /**
   * Sends a message to a recipient.
   */
  abstract send(message: NotificationMessage): Promise<boolean>;

  /**
   * Returns the name of the provider.
   */
  abstract getProviderName(): string;
}
