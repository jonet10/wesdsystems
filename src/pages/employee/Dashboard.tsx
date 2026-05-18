import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Calendar, Clock, Wallet, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";

interface EmployeeAppointment {
  id: string;
  client_name: string;
  service_name: string;
  start_hour: number;
  duration: number;
  date: string;
}

interface CommissionResult {
  gross_revenue: number;
  commission_total: number;
}

const toISODate = (date: Date): string => date.toISOString().split("T")[0];

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const { format } = useCurrency();
  const [employeeName, setEmployeeName] = useState("Employé");
  const [appointments, setAppointments] = useState<EmployeeAppointment[]>([]);
  const [commissionDay, setCommissionDay] = useState<CommissionResult>({ gross_revenue: 0, commission_total: 0 });
  const [commissionWeek, setCommissionWeek] = useState<CommissionResult>({ gross_revenue: 0, commission_total: 0 });
  const [commissionMonth, setCommissionMonth] = useState<CommissionResult>({ gross_revenue: 0, commission_total: 0 });

  useEffect(() => {
    const loadEmployeeData = async () => {
      if (!user?.id) return;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      if (profileData?.full_name) {
        setEmployeeName(profileData.full_name);
      }

      const { data: linkData } = await supabase
        .from("employee_accounts")
        .select("employee_id")
        .eq("auth_user_id", user.id)
        .single();

      if (!linkData?.employee_id) return;

      const employeeId = linkData.employee_id as string;
      const today = new Date();
      const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const weekStart = new Date(dayStart);
      weekStart.setDate(dayStart.getDate() - ((dayStart.getDay() + 6) % 7));
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      const todayStr = toISODate(today);

      const { data: aptData } = await supabase
        .from("transactions")
        .select("id, client_name, service_name, start_hour, duration, date")
        .eq("employee_id", employeeId)
        .eq("date", todayStr)
        .order("start_hour", { ascending: true });

      setAppointments((aptData || []) as EmployeeAppointment[]);

      const [{ data: dayRows }, { data: weekRows }, { data: monthRows }] = await Promise.all([
        supabase.rpc("calculate_employee_commission", {
          p_employee_id: employeeId,
          p_start_date: todayStr,
          p_end_date: todayStr,
        }),
        supabase.rpc("calculate_employee_commission", {
          p_employee_id: employeeId,
          p_start_date: toISODate(weekStart),
          p_end_date: todayStr,
        }),
        supabase.rpc("calculate_employee_commission", {
          p_employee_id: employeeId,
          p_start_date: toISODate(monthStart),
          p_end_date: todayStr,
        }),
      ]);

      const pick = (rows: unknown): CommissionResult => {
        const r = Array.isArray(rows) && rows[0] ? (rows[0] as Record<string, unknown>) : {};
        return {
          gross_revenue: Number(r.gross_revenue || 0),
          commission_total: Number(r.commission_total || 0),
        };
      };

      setCommissionDay(pick(dayRows));
      setCommissionWeek(pick(weekRows));
      setCommissionMonth(pick(monthRows));
    };

    void loadEmployeeData();
  }, [user?.id]);

  const totalDurationHours = useMemo(
    () => appointments.reduce((sum, apt) => sum + Number(apt.duration || 0), 0),
    [appointments]
  );

  const stats = [
    { title: "RDV aujourd'hui", value: appointments.length.toString(), icon: <Calendar className="h-6 w-6" /> },
    { title: "Heures planifiées", value: `${totalDurationHours.toFixed(1)}h`, icon: <Clock className="h-6 w-6" /> },
    { title: "Commission du jour", value: format(commissionDay.commission_total), icon: <Wallet className="h-6 w-6" /> },
    { title: "Commission du mois", value: format(commissionMonth.commission_total), icon: <TrendingUp className="h-6 w-6" /> },
  ];

  return (
    <DashboardLayout role="employee" title="Mon Dashboard" subtitle={`Bonjour ${employeeName} !`} userName={employeeName}>
      <StaggerContainer className="space-y-8">
        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <StatCard key={index} {...stat} />
            ))}
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-card rounded-xl border border-border p-6">
              <p className="text-sm text-muted-foreground">Revenus jour</p>
              <p className="text-2xl font-bold">{format(commissionDay.gross_revenue)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-6">
              <p className="text-sm text-muted-foreground">Revenus semaine</p>
              <p className="text-2xl font-bold">{format(commissionWeek.gross_revenue)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-6">
              <p className="text-sm text-muted-foreground">Revenus mois</p>
              <p className="text-2xl font-bold">{format(commissionMonth.gross_revenue)}</p>
            </div>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="bg-card rounded-xl border border-border shadow-card">
            <div className="p-6 border-b border-border">
              <h2 className="text-lg font-semibold font-display">Prestations du jour</h2>
            </div>
            <div className="divide-y divide-border">
              {appointments.length === 0 && <p className="p-6 text-sm text-muted-foreground">Aucun rendez-vous aujourd'hui.</p>}
              {appointments.map((apt) => (
                <div key={apt.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{apt.client_name || "Client"}</p>
                    <p className="text-sm text-muted-foreground">{apt.service_name || "Prestation"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{String(apt.start_hour ?? "").replace(".", ":")}</p>
                    <p className="text-xs text-muted-foreground">{apt.duration}h</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </StaggerItem>
      </StaggerContainer>
    </DashboardLayout>
  );
}
