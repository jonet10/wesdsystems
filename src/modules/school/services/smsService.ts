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

  /** Core method to send SMS. Saves a log in DB */
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

    // Trigger SMS delivery mechanism
    if (success && settings.provider === "Twilio") {
      // For real Twilio dispatch, in a full backend it would call an Edge Function or microservice.
      // Here we simulate the request:
      try {
        // Mocking API call to a serverless gateway
        console.log(`[Twilio SMS Dispatch] To: ${cleanPhone}, Msg: ${message}`);
        success = true;
      } catch (err) {
        success = false;
      }
    } else {
      // Mock Simulator: automatically succeeds
      console.log(`[Mock SMS Simulator] To: ${cleanPhone}, Msg: ${message}`);
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

    if (logError) console.error("Error creating SMS log:", logError);

    return success;
  },

  /** Trigger automatic alert when student is marked absent */
  async triggerAttendanceAlert(studentName: string, parentPhone: string, date: string): Promise<void> {
    const settings = await smsService.getSettings();
    if (!settings.enable_attendance_alert) return;

    const message = `Wesd School : Bonjour, nous vous informons que votre enfant ${studentName} a été marqué ABSENT lors de l'appel du ${new Date(date).toLocaleDateString("fr-FR")}. Veuillez contacter la direction pour justifier cette absence.`;
    await smsService.sendSMS(parentPhone, message);
  },

  /** Trigger automatic alert on invoice creation */
  async triggerInvoiceAlert(studentName: string, parentPhone: string, invoiceNumber: string, balance: number): Promise<void> {
    const settings = await smsService.getSettings();
    if (!settings.enable_payment_alert) return;

    const message = `Wesd School : Bonjour, la facture scolarité N° ${invoiceNumber} pour ${studentName} a été émise. Le solde à payer est de ${balance} HTG. Merci pour votre collaboration.`;
    await smsService.sendSMS(parentPhone, message);
  },

  /** Trigger automatic alert on payment receipt */
  async triggerPaymentAlert(studentName: string, parentPhone: string, receiptNumber: string, amount: number, remainingBalance: number): Promise<void> {
    const settings = await smsService.getSettings();
    if (!settings.enable_payment_alert) return;

    const message = `Wesd School : Paiement reçu avec succès ! Reçu N° ${receiptNumber} pour ${studentName}. Montant payé : ${amount} HTG. Solde restant : ${remainingBalance} HTG. Merci de votre confiance.`;
    await smsService.sendSMS(parentPhone, message);
  }
};
