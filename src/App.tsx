import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { PricingProvider } from "@/contexts/PricingContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { Suspense } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

// Pages
import Landing from "./pages/Landing";
import Login from "./pages/auth/Login";
import ForgotPassword from "./pages/auth/ForgotPassword";
import Register from "./pages/auth/Register";
import PartnerRegister from "./pages/auth/PartnerRegister";
import MonCashConfirmation from "./pages/MonCashConfirmation";
import MonCashSubscriptionPay from "./pages/MonCashSubscriptionPay";
import SuperAdminDashboard from "./pages/admin/Dashboard";
import SuperAdminSalons from "./pages/admin/Salons";
import SuperAdminModules from "./pages/admin/Modules";
import SuperAdminSubscriptions from "./pages/admin/Subscriptions";
import SuperAdminPartners from "./pages/admin/Partners";
import SuperAdminPartnerApplications from "./pages/admin/PartnerApplications";
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
import ExpensesPage from "./pages/salon/Expenses";
import ReportsPage from "./pages/salon/Reports";
import PromotionsPage from "./pages/salon/Promotions";
import EmployeeDashboard from "./pages/employee/Dashboard";
import EmployeeSchedule from "./pages/employee/Schedule";
import PartnerDashboard from "./pages/partner/Dashboard";
import BarDashboard from "./pages/bar/Dashboard";
import BarPOS from "./pages/bar/POS";
import BarInventory from "./pages/bar/Inventory";
import BarCocktails from "./pages/bar/Cocktails";
import AutoPartsDashboard from "./pages/auto-parts/Dashboard";
import AutoPartsProducts from "./pages/auto-parts/Products";
import AutoPartsCategories from "./pages/auto-parts/Categories";
import AutoPartsBrands from "./pages/auto-parts/Brands";
import AutoPartsModels from "./pages/auto-parts/Models";
import AutoPartsCompatibilities from "./pages/auto-parts/Compatibilities";
import AutoPartsSuppliers from "./pages/auto-parts/Suppliers";
import AutoPartsClients from "./pages/auto-parts/Clients";
import AutoPartsPOS from "./pages/auto-parts/POS";
import AutoPartsPurchases from "./pages/auto-parts/Purchases";
import AutoPartsStockMovements from "./pages/auto-parts/StockMovements";
import AutoPartsReports from "./pages/auto-parts/Reports";
import AutoPartsStaff from "./pages/auto-parts/Staff";
import NotFound from "./pages/NotFound";

const salonAdminRoutes: { path: string; element: JSX.Element }[] = [
  { path: "", element: <SalonDashboard /> },
  { path: "/clients", element: <ClientsPage /> },
  { path: "/services", element: <ServicesPage /> },
  { path: "/appointments", element: <AppointmentsPage /> },
  { path: "/employees", element: <SalonEmployees /> },
  { path: "/settings", element: <SalonSettings /> },
  { path: "/inventory", element: <InventoryPage /> },
  { path: "/pos", element: <POSPage /> },
  { path: "/sales-analytics", element: <SalesAnalyticsPage /> },
  { path: "/products", element: <ProductsPage /> },
  { path: "/expenses", element: <ExpensesPage /> },
  { path: "/reports", element: <ReportsPage /> },
  { path: "/promotions", element: <PromotionsPage /> },
];

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="wesd-theme">
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
                <Route path="/auth/forgot-password" element={<ForgotPassword />} />
                <Route path="/auth/register" element={<Register />} />
                <Route path="/register/partner" element={<PartnerRegister />} />
                <Route path="/become-partner" element={<PartnerRegister />} />
                <Route path="/inscription-partenaire" element={<PartnerRegister />} />
                <Route path="/devenir-partenaire" element={<PartnerRegister />} />
                <Route path="/moncash/confirmation" element={<MonCashConfirmation />} />
                <Route path="/billing/moncash" element={<MonCashSubscriptionPay />} />

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
                  path="/admin/modules"
                  element={
                    <ProtectedRoute allowedRoles={["super_admin"]}>
                      <SuperAdminModules />
                    </ProtectedRoute>
                  }
                />
                <Route path="/admin/catalog" element={<Navigate to="/admin/modules" replace />} />
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
                  path="/admin/partners/applications"
                  element={
                    <ProtectedRoute allowedRoles={["super_admin"]}>
                      <SuperAdminPartnerApplications />
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

                {/* Salon / Pharmacie / Market / Boutique Routes */}
                {(["salon", "pharmacie", "market", "boutique"] as const).flatMap(prefix =>
                  salonAdminRoutes.map(route => (
                    <Route
                      key={`${prefix}/${route.path}`}
                      path={`/${prefix}${route.path}`}
                      element={
                        <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole>
                          {route.element}
                        </ProtectedRoute>
                      }
                    />
                  )).concat(
                    <Route
                      key={`${prefix}/beverages`}
                      path={`/${prefix}/beverages`}
                      element={
                        <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole>
                          <Navigate to={`/${prefix}/products`} replace />
                        </ProtectedRoute>
                      }
                    />
                  )
                )}
                <Route
                  path="/services"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole>
                      <ServicesPage />
                    </ProtectedRoute>
                  }
                />

                {/* Bar & Restaurant Routes */}
                <Route
                  path="/bar"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "bar_admin"]} allowAuthenticatedWithoutRole>
                      <BarDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/bar/pos"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "bar_admin", "employee"]} allowAuthenticatedWithoutRole>
                      <BarPOS />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/bar/inventory"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "bar_admin"]} allowAuthenticatedWithoutRole>
                      <BarInventory />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/bar/cocktails"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "bar_admin"]} allowAuthenticatedWithoutRole>
                      <BarCocktails />
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
                  path="/employee/pos"
                  element={
                    <ProtectedRoute allowedRoles={["employee"]}>
                      <POSPage />
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

                {/* Auto Parts Routes */}
                <Route
                  path="/auto-parts"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole>
                      <AutoPartsDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/auto-parts/products"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole>
                      <AutoPartsProducts />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/auto-parts/categories"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole>
                      <AutoPartsCategories />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/auto-parts/brands"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole>
                      <AutoPartsBrands />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/auto-parts/models"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole>
                      <AutoPartsModels />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/auto-parts/compatibilities"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole>
                      <AutoPartsCompatibilities />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/auto-parts/suppliers"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole>
                      <AutoPartsSuppliers />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/auto-parts/clients"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole>
                      <AutoPartsClients />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/auto-parts/pos"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole>
                      <AutoPartsPOS />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/auto-parts/purchases"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole>
                      <AutoPartsPurchases />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/auto-parts/stock-movements"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole>
                      <AutoPartsStockMovements />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/auto-parts/reports"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole>
                      <AutoPartsReports />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/auto-parts/settings"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole>
                      <SalonSettings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/auto-parts/staff"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole>
                      <AutoPartsStaff />
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
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
