import { NotificationProvider, NotificationMessage, ProviderConfig } from './NotificationProvider';
import { OpenWAProvider } from './providers/OpenWAProvider';

export class NotificationManager {
  private static instance: NotificationManager;
  private provider: NotificationProvider | null = null;

  private constructor() {}

  public static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  public async initializeProvider(providerType: string, config: ProviderConfig) {
    switch (providerType.toLowerCase()) {
      case 'openwa':
        this.provider = new OpenWAProvider(config);
        break;
      // Add cases for 'ultramsg', 'twilio', 'meta' later
      default:
        console.warn(`[NotificationManager] Provider ${providerType} non supporté, fallback vers OpenWA`);
        this.provider = new OpenWAProvider(config);
        break;
    }

    if (this.provider) {
      await this.provider.initialize();
    }
  }

  public async sendNotification(message: NotificationMessage): Promise<boolean> {
    if (!this.provider) {
      console.warn("[NotificationManager] Aucun provider initialisé. Le message ne peut pas être envoyé.");
      return false;
    }
    return await this.provider.send(message);
  }
}
