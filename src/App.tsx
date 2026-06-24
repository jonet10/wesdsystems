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
import { Suspense, lazy } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { PWAInstallPrompt } from "@/components/shared/PWAInstallPrompt";

// Pages
import Landing from "./pages/Landing";
import Login from "./pages/auth/Login";
// Pharmacy Pages
import PharmacyDashboard from "./pages/pharmacy/Dashboard";
import PharmacySettings from "./pages/pharmacy/Settings";
import PharmacyProducts from "./pages/pharmacy/Products";
import PharmacyCategories from "./pages/pharmacy/Categories";
import PharmacyBatches from "./pages/pharmacy/Batches";
import PharmacySuppliers from "./pages/pharmacy/Suppliers";
import PharmacyPurchases from "./pages/pharmacy/Purchases";
import PharmacyStock from "./pages/pharmacy/Stock";
import PharmacyPOS from "./pages/pharmacy/POS";
import PharmacyPatients from "./pages/pharmacy/Patients";
import PharmacyPrescriptions from "./pages/pharmacy/Prescriptions";
import PharmacyCredits from "./pages/pharmacy/Credits";
import PharmacyRegisters from "./pages/pharmacy/Registers";
import PharmacyReports from "./pages/pharmacy/Reports";
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
import SuperAdminManualPaymentsPage from "./pages/admin/ManualPayments";
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

// School
import SchoolDashboard from "./pages/school/Dashboard";
import SchoolSettings from "./pages/school/Settings";
import SchoolAcademicYears from "./pages/school/AcademicYears";
import SchoolClasses from "./pages/school/Classes";
import SchoolFees from "./pages/school/Fees";
import SchoolStudents from "./pages/school/Students";
import SchoolParents from "./pages/school/Parents";
import SchoolTeachers from "./pages/school/Teachers";
import SchoolInvoices from "./pages/school/Invoices";
import SchoolPayments from "./pages/school/Payments";
const SchoolExpenses = lazy(() => import("@/pages/school/Expenses"));
const SchoolInventory = lazy(() => import("@/pages/school/Inventory"));
const SchoolPOS = lazy(() => import("@/pages/school/POS"));
const SchoolReports = lazy(() => import("@/pages/school/Reports"));
import ParentDashboard from "./pages/school/parent/Dashboard";
import EnrollmentsPage from "./pages/school/enrollments/EnrollmentsPage";
import StudentFinancialSheet from "./pages/school/finance/StudentFinancialSheet";
import SchoolStaff from "./pages/school/Staff";
import AutoPartsPurchases from "./pages/auto-parts/Purchases";
import AutoPartsStockMovements from "./pages/auto-parts/StockMovements";
import AutoPartsSettings from "./pages/auto-parts/Settings";
import AutoPartsReports from "./pages/auto-parts/Reports";
import AutoPartsStaff from "./pages/auto-parts/Staff";
import AutoPartsReturns from "./pages/auto-parts/Returns";
import AutoPartsInvoices from "./pages/auto-parts/Invoices";
import AutoPartsQuotes from "./pages/auto-parts/Quotes";
import AutoPartsDeliveryNotes from "./pages/auto-parts/DeliveryNotes";
import AutoPartsBranches from "./pages/auto-parts/Branches";
import NotFound from "./pages/NotFound";
import { PERMISSIONS, type Permission } from "@/config/permissions";

import SalonBranches from "./pages/salon/Branches";

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
  { path: "/branches", element: <SalonBranches /> },
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
                <Route
                  path="/admin/manual-payments"
                  element={
                    <ProtectedRoute allowedRoles={["super_admin"]}>
                      <SuperAdminManualPaymentsPage />
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
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole requiredPermissions={PERMISSIONS.DASHBOARD_VIEW}>
                      <AutoPartsDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/auto-parts/products"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole requiredPermissions={PERMISSIONS.PRODUCTS_READ}>
                      <AutoPartsProducts />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/auto-parts/categories"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole requiredPermissions={PERMISSIONS.CATEGORIES_MANAGE}>
                      <AutoPartsCategories />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/auto-parts/brands"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole requiredPermissions={PERMISSIONS.BRANDS_MANAGE}>
                      <AutoPartsBrands />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/auto-parts/models"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole requiredPermissions={PERMISSIONS.MODELS_MANAGE}>
                      <AutoPartsModels />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/auto-parts/compatibilities"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole requiredPermissions={PERMISSIONS.COMPATIBILITIES_MANAGE}>
                      <AutoPartsCompatibilities />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/auto-parts/suppliers"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole requiredPermissions={PERMISSIONS.SUPPLIERS_MANAGE}>
                      <AutoPartsSuppliers />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/auto-parts/clients"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole requiredPermissions={PERMISSIONS.CLIENTS_READ}>
                      <AutoPartsClients />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/auto-parts/pos"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole requiredPermissions={PERMISSIONS.POS_VIEW}>
                      <AutoPartsPOS />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/auto-parts/purchases"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole requiredPermissions={PERMISSIONS.PURCHASES_MANAGE}>
                      <AutoPartsPurchases />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/auto-parts/stock-movements"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole requiredPermissions={PERMISSIONS.STOCK_VIEW}>
                      <AutoPartsStockMovements />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/auto-parts/reports"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole requiredPermissions={PERMISSIONS.REPORTS_VIEW}>
                      <AutoPartsReports />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/auto-parts/returns"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole requiredPermissions={PERMISSIONS.RETURNS_MANAGE}>
                      <AutoPartsReturns />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/auto-parts/settings"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole requiredPermissions={PERMISSIONS.SETTINGS_MANAGE}>
                      <AutoPartsSettings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/auto-parts/invoices"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole requiredPermissions={PERMISSIONS.DASHBOARD_VIEW}>
                      <AutoPartsInvoices />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/auto-parts/quotes"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole requiredPermissions={PERMISSIONS.DASHBOARD_VIEW}>
                      <AutoPartsQuotes />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/auto-parts/delivery-notes"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole requiredPermissions={PERMISSIONS.DASHBOARD_VIEW}>
                      <AutoPartsDeliveryNotes />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/auto-parts/branches"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole requiredPermissions={PERMISSIONS.SETTINGS_MANAGE}>
                      <AutoPartsBranches />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/auto-parts/staff"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole requiredPermissions={PERMISSIONS.STAFF_MANAGE}>
                      <AutoPartsStaff />
                    </ProtectedRoute>
                  }
                />

                {/* School Routes */}
                <Route
                  path="/school"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "school_admin", "school_accountant", "school_cashier", "school_teacher"]} allowAuthenticatedWithoutRole>
                      <SchoolDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/staff"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "school_admin"]} allowAuthenticatedWithoutRole>
                      <SchoolStaff />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/settings"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "school_admin"]} allowAuthenticatedWithoutRole>
                      <SchoolSettings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/academic-years"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "school_admin"]} allowAuthenticatedWithoutRole>
                      <SchoolAcademicYears />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/classes"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "school_admin"]} allowAuthenticatedWithoutRole>
                      <SchoolClasses />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/fees"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "school_admin"]} allowAuthenticatedWithoutRole>
                      <SchoolFees />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/students"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "school_admin", "school_accountant"]} allowAuthenticatedWithoutRole>
                      <SchoolStudents />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/enrollments"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "school_admin", "school_manager"]} allowAuthenticatedWithoutRole>
                      <EnrollmentsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/finance/student"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "school_admin", "school_accountant"]} allowAuthenticatedWithoutRole>
                      <StudentFinancialSheet />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/parents"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "school_admin", "school_accountant"]} allowAuthenticatedWithoutRole>
                      <SchoolParents />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/teachers"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "school_admin"]} allowAuthenticatedWithoutRole>
                      <SchoolTeachers />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/invoices"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "school_admin", "school_accountant"]} allowAuthenticatedWithoutRole>
                      <SchoolInvoices />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/payments"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "school_admin", "school_accountant", "school_cashier"]} allowAuthenticatedWithoutRole>
                      <SchoolPayments />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/expenses"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "school_admin", "school_accountant"]} allowAuthenticatedWithoutRole>
                      <SchoolExpenses />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/inventory"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "school_admin", "school_manager"]} allowAuthenticatedWithoutRole>
                      <SchoolInventory />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/pos"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "school_admin", "school_accountant", "school_cashier"]} allowAuthenticatedWithoutRole>
                      <SchoolPOS />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/reports"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "school_admin", "school_accountant"]} allowAuthenticatedWithoutRole>
                      <SchoolReports />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/parent/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={["school_parent"]} allowAuthenticatedWithoutRole>
                      <ParentDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Pharmacy Routes */}
                <Route path="/pharmacie" element={<ProtectedRoute allowedRoles={["salon_admin", "pharmacy_admin", "pharmacy_manager", "pharmacy_cashier"]} allowAuthenticatedWithoutRole><PharmacyDashboard /></ProtectedRoute>} />
                <Route path="/pharmacie/settings" element={<ProtectedRoute allowedRoles={["salon_admin", "pharmacy_admin"]} allowAuthenticatedWithoutRole><PharmacySettings /></ProtectedRoute>} />
                <Route path="/pharmacie/products" element={<ProtectedRoute allowedRoles={["salon_admin", "pharmacy_admin", "pharmacy_manager"]} allowAuthenticatedWithoutRole><PharmacyProducts /></ProtectedRoute>} />
                <Route path="/pharmacie/categories" element={<ProtectedRoute allowedRoles={["salon_admin", "pharmacy_admin", "pharmacy_manager"]} allowAuthenticatedWithoutRole><PharmacyCategories /></ProtectedRoute>} />
                <Route path="/pharmacie/batches" element={<ProtectedRoute allowedRoles={["salon_admin", "pharmacy_admin", "pharmacy_manager", "pharmacy_stock_manager"]} allowAuthenticatedWithoutRole><PharmacyBatches /></ProtectedRoute>} />
                <Route path="/pharmacie/suppliers" element={<ProtectedRoute allowedRoles={["salon_admin", "pharmacy_admin", "pharmacy_manager"]} allowAuthenticatedWithoutRole><PharmacySuppliers /></ProtectedRoute>} />
                <Route path="/pharmacie/purchases" element={<ProtectedRoute allowedRoles={["salon_admin", "pharmacy_admin", "pharmacy_manager", "pharmacy_stock_manager"]} allowAuthenticatedWithoutRole><PharmacyPurchases /></ProtectedRoute>} />
                <Route path="/pharmacie/stock" element={<ProtectedRoute allowedRoles={["salon_admin", "pharmacy_admin", "pharmacy_manager", "pharmacy_stock_manager"]} allowAuthenticatedWithoutRole><PharmacyStock /></ProtectedRoute>} />
                <Route path="/pharmacie/pos" element={<ProtectedRoute allowedRoles={["salon_admin", "pharmacy_admin", "pharmacy_manager", "pharmacy_cashier"]} allowAuthenticatedWithoutRole><PharmacyPOS /></ProtectedRoute>} />
                <Route path="/pharmacie/patients" element={<ProtectedRoute allowedRoles={["salon_admin", "pharmacy_admin", "pharmacy_manager", "pharmacy_cashier"]} allowAuthenticatedWithoutRole><PharmacyPatients /></ProtectedRoute>} />
                <Route path="/pharmacie/prescriptions" element={<ProtectedRoute allowedRoles={["salon_admin", "pharmacy_admin", "pharmacy_manager", "pharmacy_cashier"]} allowAuthenticatedWithoutRole><PharmacyPrescriptions /></ProtectedRoute>} />
                <Route path="/pharmacie/credits" element={<ProtectedRoute allowedRoles={["salon_admin", "pharmacy_admin", "pharmacy_manager", "pharmacy_accountant"]} allowAuthenticatedWithoutRole><PharmacyCredits /></ProtectedRoute>} />
                <Route path="/pharmacie/registers" element={<ProtectedRoute allowedRoles={["salon_admin", "pharmacy_admin", "pharmacy_manager", "pharmacy_accountant", "pharmacy_cashier"]} allowAuthenticatedWithoutRole><PharmacyRegisters /></ProtectedRoute>} />
                <Route path="/pharmacie/reports" element={<ProtectedRoute allowedRoles={["salon_admin", "pharmacy_admin", "pharmacy_manager", "pharmacy_accountant"]} allowAuthenticatedWithoutRole><PharmacyReports /></ProtectedRoute>} />

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
    <Suspense fallback={null}>
      <OfflineBanner />
      <PWAInstallPrompt />
    </Suspense>
  </ErrorBoundary>
);

export default App;
