export interface SalonAppointmentSummary {
  id: string;
  clientName: string;
  serviceName: string;
  employeeName?: string;
  scheduledAt: string;
  status: string;
}

