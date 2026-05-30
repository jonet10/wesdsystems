import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { PricingProvider } from "@/contexts/PricingContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { Suspense } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

// Pages
import Landing from "./pages/Landing";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import PartnerRegister from "./pages/auth/PartnerRegister";
import SuperAdminDashboard from "./pages/admin/Dashboard";
import SuperAdminSalons from "./pages/admin/Salons";
import SuperAdminCatalog from "./pages/admin/Catalog";
import SuperAdminSubscriptions from "./pages/admin/Subscriptions";
import SuperAdminPartners from "./pages/admin/Partners";
import SuperAdminSettings from "./pages/admin/Settings";
import SalonDashboard from "./pages/salon/Dashboard";
import ClientsPage from "./pages/salon/Clients";
import ServicesPage from "./pages/salon/Services";
import AppointmentsPage from "./pages/salon/Appointments";
import SalonEmployees from "./pages/salon/Employees";
import SalonSettings from "./pages/salon/Settings";
import InventoryPage from "./pages/salon/Inventory";
import POSPage from "./pages/salon/POS";
import SalesAnalyticsPage from "./pages/salon/SalesAnalytics";
import ProductsPage from "./pages/salon/Products";
import BeveragesPage from "./pages/salon/Beverages";
import ExpensesPage from "./pages/salon/Expenses";
import ReportsPage from "./pages/salon/Reports";
import PromotionsPage from "./pages/salon/Promotions";
import EmployeeDashboard from "./pages/employee/Dashboard";
import EmployeeSchedule from "./pages/employee/Schedule";
import PartnerDashboard from "./pages/partner/Dashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <CurrencyProvider>
        <PricingProvider>
          <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center font-sans font-medium text-gray-500">Chargement de la plateforme...</div>}>
                <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Landing />} />
                <Route path="/auth/login" element={<Login />} />
                <Route path="/auth/register" element={<Register />} />
                <Route path="/register/partner" element={<PartnerRegister />} />
                <Route path="/become-partner" element={<PartnerRegister />} />
                <Route path="/inscription-partenaire" element={<PartnerRegister />} />
                <Route path="/devenir-partenaire" element={<PartnerRegister />} />

                {/* Super Admin Routes */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute allowedRoles={["super_admin"]}>
                      <SuperAdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/salons"
                  element={
                    <ProtectedRoute allowedRoles={["super_admin"]}>
                      <SuperAdminSalons />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/catalog"
                  element={
                    <ProtectedRoute allowedRoles={["super_admin"]}>
                      <SuperAdminCatalog />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/subscriptions"
                  element={
                    <ProtectedRoute allowedRoles={["super_admin"]}>
                      <SuperAdminSubscriptions />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/partners"
                  element={
                    <ProtectedRoute allowedRoles={["super_admin"]}>
                      <SuperAdminPartners />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/settings"
                  element={
                    <ProtectedRoute allowedRoles={["super_admin"]}>
                      <SuperAdminSettings />
                    </ProtectedRoute>
                  }
                />

                {/* Salon Admin Routes */}
                <Route
                  path="/salon"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole>
                      <SalonDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/salon/clients"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole>
                      <ClientsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/salon/services"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole>
                      <ServicesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/salon/appointments"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole>
                      <AppointmentsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/salon/employees"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole>
                      <SalonEmployees />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/salon/settings"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole>
                      <SalonSettings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/salon/inventory"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole>
                      <InventoryPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/salon/pos"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole>
                      <POSPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/salon/sales-analytics"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole>
                      <SalesAnalyticsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/salon/products"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole>
                      <ProductsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/salon/beverages"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole>
                      <BeveragesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/salon/expenses"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole>
                      <ExpensesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/salon/reports"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole>
                      <ReportsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/salon/promotions"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole>
                      <PromotionsPage />
                    </ProtectedRoute>
                  }
                />

                {/* Employee Routes */}
                <Route
                  path="/employee"
                  element={
                    <ProtectedRoute allowedRoles={["employee"]}>
                      <EmployeeDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/employee/schedule"
                  element={
                    <ProtectedRoute allowedRoles={["employee"]}>
                      <EmployeeSchedule />
                    </ProtectedRoute>
                  }
                />

                {/* Partner Routes */}
                <Route
                  path="/partner"
                  element={
                    <ProtectedRoute allowedRoles={["partner"]}>
                      <PartnerDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/partner/clients"
                  element={
                    <ProtectedRoute allowedRoles={["partner"]}>
                      <PartnerDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/partner/subscriptions"
                  element={
                    <ProtectedRoute allowedRoles={["partner"]}>
                      <PartnerDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/partner/commissions"
                  element={
                    <ProtectedRoute allowedRoles={["partner"]}>
                      <PartnerDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/partner/payouts"
                  element={
                    <ProtectedRoute allowedRoles={["partner"]}>
                      <PartnerDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/partner/referrals"
                  element={
                    <ProtectedRoute allowedRoles={["partner"]}>
                      <PartnerDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/partner/marketing"
                  element={
                    <ProtectedRoute allowedRoles={["partner"]}>
                      <PartnerDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/partner/reports"
                  element={
                    <ProtectedRoute allowedRoles={["partner"]}>
                      <PartnerDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
        </PricingProvider>
      </CurrencyProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
