import { supabase } from "@/lib/supabase";
import { getBusinessId } from "./utils";

export interface SchoolSmsSettings {
  id?: string;
  business_id: string;
  provider: 'Twilio' | 'Mock';
  api_key?: string | null;
  sender_id?: string | null;
  enable_attendance_alert: boolean;
  enable_payment_alert: boolean;
  created_at?: string;
}

export interface SchoolSmsLog {
  id?: string;
  business_id: string;
  recipient: string;
  message: string;
  status: 'sent' | 'failed';
  created_at?: string;
}

export const smsService = {
  async getSettings(): Promise<SchoolSmsSettings> {
    const businessId = getBusinessId();
    const { data, error } = await supabase
      .from("school_sms_settings")
      .select("*")
      .eq("business_id", businessId)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      // Create default settings if not exists
      const { data: created, error: createError } = await supabase
        .from("school_sms_settings")
        .insert([{
          business_id: businessId,
          provider: 'Mock',
          enable_attendance_alert: false,
          enable_payment_alert: false
        }])
        .select()
        .single();
      if (createError) throw createError;
      return created as SchoolSmsSettings;
    }

    return data as SchoolSmsSettings;
  },

  async updateSettings(payload: Partial<SchoolSmsSettings>): Promise<SchoolSmsSettings> {
    const businessId = getBusinessId();
    
    // Check if exists
    const current = await smsService.getSettings();

    const { data, error } = await supabase
      .from("school_sms_settings")
      .update(payload)
      .eq("id", current.id)
      .select()
      .single();

    if (error) throw error;
    return data as SchoolSmsSettings;
  },

  async getLogs(): Promise<SchoolSmsLog[]> {
    const businessId = getBusinessId();
    const { data, error } = await supabase
      .from("school_sms_logs")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data as SchoolSmsLog[];
  },

  /** Core method to send SMS/WhatsApp. Saves a log in DB */
  async sendSMS(recipient: string, message: string): Promise<boolean> {
    const businessId = getBusinessId();
    const settings = await smsService.getSettings();

    let success = true;

    if (!recipient || recipient === '-' || recipient.trim() === '') {
      return false;
    }

    // Clean phone number (remove spaces, parentheses, etc.)
    const cleanPhone = recipient.replace(/\D/g, "");
    if (cleanPhone.length < 8) {
      // Too short to be a valid phone number
      success = false;
    }

    // Trigger WhatsApp delivery mechanism if provider is Twilio (Production)
    if (success && settings.provider === "Twilio") {
      try {
        const { data: globalConfigData } = await supabase.rpc("get_app_config");
        const globalConfig = globalConfigData || {};

        const isGlobalEnabled = globalConfig.whatsapp_global_enabled !== "false";
        if (isGlobalEnabled) {
          const providerName = globalConfig.whatsapp_global_provider || "openwa";
          let apiUrl = globalConfig.whatsapp_global_api_url || "";
          if (!apiUrl || apiUrl === "default") {
            apiUrl = "http://localhost:3000";
          }
          const apiKey = globalConfig.whatsapp_global_api_key || "";
          const sessionName = globalConfig.whatsapp_global_session_name || "default";

          const { OpenWaProvider, UltraMsgProvider, MetaCloudProvider, TwilioProvider } = await import("@/modules/pharmacy/services/whatsappService");
          
          let provider;
          if (providerName === "ultramsg") provider = new UltraMsgProvider();
          else if (providerName === "meta") provider = new MetaCloudProvider();
          else if (providerName === "twilio") provider = new TwilioProvider();
          else provider = new OpenWaProvider();

          const res = await provider.sendMessage(apiUrl, apiKey, cleanPhone, message, sessionName);
          success = res.success;
        } else {
          console.warn("[School WhatsApp] WhatsApp disabled globally.");
          success = false;
        }
      } catch (err) {
        console.error("[School WhatsApp] Send error:", err);
        success = false;
      }
    } else {
      // Mock Simulator: automatically succeeds
      console.log(`[Mock WhatsApp Simulator] To: ${cleanPhone}, Msg: ${message}`);
      success = true;
    }

    // Record Log in DB
    const { error: logError } = await supabase
      .from("school_sms_logs")
      .insert([{
        business_id: businessId,
        recipient: cleanPhone || recipient,
        message,
        status: success ? 'sent' : 'failed'
      }]);

    if (logError) console.error("Error creating WhatsApp log:", logError);

    return success;
  },

  async getSchoolName(): Promise<string> {
    const businessId = getBusinessId();
    try {
      const { data } = await supabase
        .from("school_settings")
        .select("name")
        .eq("business_id", businessId)
        .maybeSingle();
      return data?.name || "L'École";
    } catch (err) {
      return "L'École";
    }
  },

  /** Trigger automatic alert when student is marked absent */
  async triggerAttendanceAlert(studentName: string, parentPhone: string, date: string): Promise<void> {
    const settings = await smsService.getSettings();
    if (!settings.enable_attendance_alert) return;

    const schoolName = await smsService.getSchoolName();
    const message = `[${schoolName}] Bonjour, nous vous informons que votre enfant ${studentName} a été marqué ABSENT lors de l'appel du ${new Date(date).toLocaleDateString("fr-FR")}. Veuillez contacter la direction pour justifier cette absence.`;
    await smsService.sendSMS(parentPhone, message);
  },

  /** Trigger automatic alert on invoice creation */
  async triggerInvoiceAlert(studentName: string, parentPhone: string, invoiceNumber: string, balance: number): Promise<void> {
    const settings = await smsService.getSettings();
    if (!settings.enable_payment_alert) return;

    const schoolName = await smsService.getSchoolName();
    const message = `[${schoolName}] Bonjour, la facture scolarité N° ${invoiceNumber} pour ${studentName} a été émise. Le solde à payer est de ${balance} HTG. Merci pour votre collaboration.`;
    await smsService.sendSMS(parentPhone, message);
  },

  /** Trigger automatic alert on payment receipt */
  async triggerPaymentAlert(studentName: string, parentPhone: string, receiptNumber: string, amount: number, remainingBalance: number): Promise<void> {
    const settings = await smsService.getSettings();
    if (!settings.enable_payment_alert) return;

    const schoolName = await smsService.getSchoolName();
    const message = `[${schoolName}] Paiement reçu avec succès ! Reçu N° ${receiptNumber} pour ${studentName}. Montant payé : ${amount} HTG. Solde restant : ${remainingBalance} HTG. Merci de votre confiance.`;
    await smsService.sendSMS(parentPhone, message);
  }
};
