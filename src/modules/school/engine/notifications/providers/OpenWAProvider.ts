import { NotificationProvider, NotificationMessage, ProviderConfig } from '../NotificationProvider';

export class OpenWAProvider extends NotificationProvider {
  constructor(config: ProviderConfig) {
    super(config);
  }

  async initialize(): Promise<void> {
    // Dans une implémentation complète, on se connecterait à l'API OpenWA ou on vérifierait l'état de l'API.
    console.log("[OpenWA] Initialization complete with URL:", this.config.apiUrl);
  }

  async send(message: NotificationMessage): Promise<boolean> {
    if (message.type !== 'whatsapp') return false;

    try {
      if (!this.config.apiUrl) {
        console.warn("[OpenWA] No API URL provided, skipping message send");
        return false;
      }

      // Exemple d'appel vers l'API OpenWA (généralement via POST /api/sendText)
      const payload = {
        chatId: `${message.to.replace(/\D/g, '')}@c.us`,
        text: message.body,
        session: "default" // ou la clé API
      };

      const response = await fetch(`${this.config.apiUrl}/api/sendText`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`OpenWA API error: ${response.statusText}`);
      }
      
      console.log(`[OpenWA] Message sent successfully to ${message.to}`);
      return true;
    } catch (error) {
      console.error("[OpenWA] Failed to send message:", error);
      return false;
    }
  }

  getProviderName(): string {
    return 'OpenWA';
  }
}
