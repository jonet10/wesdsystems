import { NotificationManager } from '../engine/notifications/NotificationManager';
import { supabase } from '@/lib/supabase';

export class SchoolNotificationService {
  /**
   * Notifie la direction que les notes ont été soumises.
   */
  static async notifyGradesSubmitted(businessId: string, teacherName: string, subjectName: string, className: string) {
    const manager = NotificationManager.getInstance();
    // En production, on irait chercher les numéros de la direction dans la BDD.
    // Pour la démo, on simule l'envoi au directeur.
    
    const message = `Le professeur ${teacherName} vient de soumettre les notes de ${subjectName} pour la classe ${className}.`;
    
    console.log("[Notification] Sending Grades Submitted alert:", message);
    
    // Simulate finding director's phone
    const directorPhone = "+50930000000"; 
    
    await manager.sendNotification({
      to: directorPhone,
      body: message,
      type: 'whatsapp'
    });
  }

  /**
   * Notifie les parents d'une absence.
   */
  static async notifyStudentAbsent(studentName: string, className: string, parentPhone: string) {
    const manager = NotificationManager.getInstance();
    
    const message = `Bonjour,\n\nNous vous informons que votre enfant ${studentName} (${className}) est absent aujourd'hui.\n\nMerci de contacter l'administration.\n\nL'Administration`;
    
    console.log("[Notification] Sending Absence alert to", parentPhone);
    
    await manager.sendNotification({
      to: parentPhone,
      body: message,
      type: 'whatsapp'
    });
  }

  /**
   * Notifie les parents d'un retard.
   */
  static async notifyStudentLate(studentName: string, arrivalTime: string, parentPhone: string) {
    const manager = NotificationManager.getInstance();
    
    const message = `Bonjour,\n\nVotre enfant ${studentName} est arrivé en retard à l'école aujourd'hui.\n\nHeure d'arrivée : ${arrivalTime}\n\nL'Administration`;
    
    console.log("[Notification] Sending Late alert to", parentPhone);
    
    await manager.sendNotification({
      to: parentPhone,
      body: message,
      type: 'whatsapp'
    });
  }

  /**
   * Notifie les parents d'un paiement reçu.
   */
  static async notifyPaymentReceived(studentName: string, amount: number, balance: number, parentPhone: string, currencySymbol: string = 'HTG') {
    const manager = NotificationManager.getInstance();
    
    const message = `Paiement reçu.\n\nÉlève : ${studentName}\nMontant : ${amount} ${currencySymbol}\nSolde restant : ${balance} ${currencySymbol}\n\nMerci.`;
    
    console.log("[Notification] Sending Payment alert to", parentPhone);
    
    await manager.sendNotification({
      to: parentPhone,
      body: message,
      type: 'whatsapp'
    });
  }
}
