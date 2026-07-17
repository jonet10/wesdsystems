import { supabase } from '@/lib/supabase';
import { smsService } from './smsService';
import { setBusinessId } from './index';

export class SchoolNotificationService {
  /**
   * Notifie la direction que les notes ont été soumises.
   */
  static async notifyGradesSubmitted(businessId: string, teacherName: string, subjectName: string, className: string) {
    try {
      if (businessId) setBusinessId(businessId);
      // 1. Get school settings (name and whatsapp/phone contact)
      const { data: settings } = await supabase
        .from("school_settings")
        .select("name, whatsapp, phone")
        .eq("business_id", businessId)
        .maybeSingle();

      const schoolName = settings?.name || "L'Établissement Scolaire";
      // Direction number: use whatsapp if present, else phone, fallback to a dummy if none
      const directorPhone = settings?.whatsapp || settings?.phone || "+50930000000";

      const message = `[${schoolName}] Notification Direction : Le professeur ${teacherName} vient de soumettre les notes de ${subjectName} pour la classe ${className}.`;

      console.log("[School WhatsApp] Sending Grades Submitted alert:", message);
      await smsService.sendSMS(directorPhone, message);
    } catch (err) {
      console.error("[School WhatsApp] Failed to send notifyGradesSubmitted:", err);
    }
  }

  /**
   * Notifie les parents d'une absence.
   */
  static async notifyStudentAbsent(studentName: string, className: string, parentPhone: string, businessId?: string) {
    try {
      if (businessId) setBusinessId(businessId);
      let schoolName = "L'École";
      if (businessId) {
        const { data: settings } = await supabase
          .from("school_settings")
          .select("name")
          .eq("business_id", businessId)
          .maybeSingle();
        if (settings?.name) schoolName = settings.name;
      }

      const message = `[${schoolName}] Bonjour, nous vous informons que votre enfant ${studentName} (${className}) est absent aujourd'hui. Veuillez contacter la direction pour justifier cette absence.`;
      
      await smsService.sendSMS(parentPhone, message);
    } catch (err) {
      console.error("[School WhatsApp] Failed to send notifyStudentAbsent:", err);
    }
  }

  /**
   * Notifie les parents d'un retard.
   */
  static async notifyStudentLate(studentName: string, arrivalTime: string, parentPhone: string, businessId?: string) {
    try {
      if (businessId) setBusinessId(businessId);
      let schoolName = "L'École";
      if (businessId) {
        const { data: settings } = await supabase
          .from("school_settings")
          .select("name")
          .eq("business_id", businessId)
          .maybeSingle();
        if (settings?.name) schoolName = settings.name;
      }

      const message = `[${schoolName}] Bonjour, votre enfant ${studentName} est arrivé en retard à l'école aujourd'hui à ${arrivalTime}. L'Administration`;
      
      await smsService.sendSMS(parentPhone, message);
    } catch (err) {
      console.error("[School WhatsApp] Failed to send notifyStudentLate:", err);
    }
  }

  /**
   * Notifie les parents d'un paiement reçu.
   */
  static async notifyPaymentReceived(studentName: string, amount: number, balance: number, parentPhone: string, currencySymbol: string = 'HTG', businessId?: string) {
    try {
      if (businessId) setBusinessId(businessId);
      let schoolName = "L'École";
      if (businessId) {
        const { data: settings } = await supabase
          .from("school_settings")
          .select("name")
          .eq("business_id", businessId)
          .maybeSingle();
        if (settings?.name) schoolName = settings.name;
      }

      const message = `[${schoolName}] Paiement reçu avec succès pour ${studentName}. Montant payé : ${amount} ${currencySymbol}. Solde restant : ${balance} ${currencySymbol}. Merci de votre confiance.`;
      
      await smsService.sendSMS(parentPhone, message);
    } catch (err) {
      console.error("[School WhatsApp] Failed to send notifyPaymentReceived:", err);
    }
  }
}
