import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { Suspense } from "react";

// Pages
import Landing from "./pages/Landing";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import SuperAdminDashboard from "./pages/admin/Dashboard";
import SuperAdminSalons from "./pages/admin/Salons";
import SuperAdminSubscriptions from "./pages/admin/Subscriptions";
import SuperAdminSettings from "./pages/admin/Settings";
import SalonDashboard from "./pages/salon/Dashboard";
import ClientsPage from "./pages/salon/Clients";
import ServicesPage from "./pages/salon/Services";
import AppointmentsPage from "./pages/salon/Appointments";
import SalonEmployees from "./pages/salon/Employees";
import SalonSettings from "./pages/salon/Settings";
import EmployeeDashboard from "./pages/employee/Dashboard";
import EmployeeSchedule from "./pages/employee/Schedule";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <CurrencyProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center font-sans font-medium text-gray-500">Chargement de la plateforme...</div>}>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Landing />} />
                <Route path="/auth/login" element={<Login />} />
                <Route path="/auth/register" element={<Register />} />

                {/* Super Admin Routes */}
                <Route path="/admin" element={<SuperAdminDashboard />} />
                <Route path="/admin/salons" element={<SuperAdminSalons />} />
                <Route path="/admin/subscriptions" element={<SuperAdminSubscriptions />} />
                <Route path="/admin/settings" element={<SuperAdminSettings />} />

                {/* Salon Admin Routes */}
                <Route path="/salon" element={<SalonDashboard />} />
                <Route path="/salon/clients" element={<ClientsPage />} />
                <Route path="/salon/services" element={<ServicesPage />} />
                <Route path="/salon/appointments" element={<AppointmentsPage />} />
                <Route path="/salon/employees" element={<SalonEmployees />} />
                <Route path="/salon/settings" element={<SalonSettings />} />

                {/* Employee Routes */}
                <Route path="/employee" element={<EmployeeDashboard />} />
                <Route path="/employee/schedule" element={<EmployeeSchedule />} />

                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </CurrencyProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;

