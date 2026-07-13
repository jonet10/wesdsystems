import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { PricingProvider } from "@/contexts/PricingContext";
import { ColorThemeProvider } from "@/contexts/ColorThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";
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
const AutoPartsDashboard = lazy(() => import("./pages/auto-parts/Dashboard"));
const AutoPartsProducts = lazy(() => import("./pages/auto-parts/Products"));
const AutoPartsCategories = lazy(() => import("./pages/auto-parts/Categories"));
const AutoPartsBrands = lazy(() => import("./pages/auto-parts/Brands"));
const AutoPartsModels = lazy(() => import("./pages/auto-parts/Models"));
const AutoPartsCompatibilities = lazy(() => import("./pages/auto-parts/Compatibilities"));
const AutoPartsSuppliers = lazy(() => import("./pages/auto-parts/Suppliers"));
const AutoPartsClients = lazy(() => import("./pages/auto-parts/Clients"));
const AutoPartsPOS = lazy(() => import("./pages/auto-parts/POS"));

// Stationery
const StationeryDashboard = lazy(() => import("./pages/stationery/Dashboard"));
const StationeryProducts = lazy(() => import("./pages/stationery/Products"));
const StationeryCategories = lazy(() => import("./pages/stationery/Categories"));
const StationeryCustomers = lazy(() => import("./pages/stationery/Customers"));
const StationerySuppliers = lazy(() => import("./pages/stationery/Suppliers"));
const StationeryPurchases = lazy(() => import("./pages/stationery/Purchases"));
const StationerySales = lazy(() => import("./pages/stationery/Sales"));
const StationeryPOS = lazy(() => import("./pages/stationery/POS"));
const StationeryExpenses = lazy(() => import("./pages/stationery/Expenses"));
const StationeryInventory = lazy(() => import("./pages/stationery/Inventory"));
const StationeryReports = lazy(() => import("./pages/stationery/Reports"));
const StationerySettings = lazy(() => import("./pages/stationery/Settings"));

// School
import SchoolDashboard from "./pages/school/Dashboard";
import SchoolSettings from "./pages/school/Settings";
import ReportBuilder from "./pages/school/builder/ReportBuilder";
import SchoolAcademicYears from "./pages/school/AcademicYears";
import SchoolClasses from "./pages/school/Classes";
import SchoolSubjects from "./pages/school/Subjects";
import SchoolFees from "./pages/school/Fees";
import SchoolStudents from "./pages/school/Students";
import SchoolParents from "./pages/school/Parents";
import SchoolTeachers from "./pages/school/Teachers";
import SchoolInvoices from "./pages/school/Invoices";
import SchoolPayments from "./pages/school/Payments";
import SchoolPayroll from "./pages/school/Payroll";
import SchoolAttendance from "./pages/school/Attendance";
import SchoolTimetables from "./pages/school/Timetables";
import SchoolGrades from "./pages/school/Grades";
const SchoolExpenses = lazy(() => import("@/pages/school/Expenses"));
const SchoolInventory = lazy(() => import("@/pages/school/Inventory"));
const SchoolPOS = lazy(() => import("@/pages/school/POS"));
const SchoolReports = lazy(() => import("@/pages/school/Reports"));
import ParentDashboard from "./pages/school/parent/Dashboard";
import TeacherLogin from "./pages/school/TeacherLogin";
import TeacherDashboard from "./pages/school/TeacherDashboard";
import TeacherGrades from "./pages/school/TeacherGrades";
import TeacherAttendance from "./pages/school/TeacherAttendance";
import EnrollmentsPage from "./pages/school/enrollments/EnrollmentsPage";
import StudentFinancialSheet from "./pages/school/finance/StudentFinancialSheet";
import SchoolStaff from "./pages/school/Staff";
import { SchoolProviderWrapper } from "./modules/school/providers/SchoolProvider";
const AutoPartsPurchases = lazy(() => import("./pages/auto-parts/Purchases"));
const AutoPartsStockMovements = lazy(() => import("./pages/auto-parts/StockMovements"));
const AutoPartsSettings = lazy(() => import("./pages/auto-parts/Settings"));
const AutoPartsReports = lazy(() => import("./pages/auto-parts/Reports"));
const AutoPartsStaff = lazy(() => import("./pages/auto-parts/Staff"));
const AutoPartsReturns = lazy(() => import("./pages/auto-parts/Returns"));
const AutoPartsInvoices = lazy(() => import("./pages/auto-parts/Invoices"));
const AutoPartsQuotes = lazy(() => import("./pages/auto-parts/Quotes"));
const AutoPartsDeliveryNotes = lazy(() => import("./pages/auto-parts/DeliveryNotes"));
const AutoPartsBranches = lazy(() => import("./pages/auto-parts/Branches"));
import NotFound from "./pages/NotFound";
import { PERMISSIONS, type Permission } from "@/config/permissions";

import SalonBranches from "./pages/salon/Branches";

const salonAdminRoutes: { path: string; element: JSX.Element; permission?: Permission }[] = [
  { path: "", element: <SalonDashboard />, permission: PERMISSIONS.DASHBOARD_VIEW },
  { path: "/clients", element: <ClientsPage />, permission: PERMISSIONS.CLIENTS_READ },
  { path: "/services", element: <ServicesPage />, permission: PERMISSIONS.SERVICES_MANAGE },
  { path: "/appointments", element: <AppointmentsPage />, permission: PERMISSIONS.APPOINTMENTS_VIEW },
  { path: "/employees", element: <SalonEmployees />, permission: PERMISSIONS.STAFF_MANAGE },
  { path: "/settings", element: <SalonSettings />, permission: PERMISSIONS.SETTINGS_MANAGE },
  { path: "/inventory", element: <InventoryPage />, permission: PERMISSIONS.STOCK_VIEW },
  { path: "/pos", element: <POSPage />, permission: PERMISSIONS.POS_VIEW },
  { path: "/sales-analytics", element: <SalesAnalyticsPage />, permission: PERMISSIONS.ANALYTICS_VIEW },
  { path: "/products", element: <ProductsPage />, permission: PERMISSIONS.PRODUCTS_READ },
  { path: "/expenses", element: <ExpensesPage />, permission: PERMISSIONS.EXPENSES_MANAGE },
  { path: "/reports", element: <ReportsPage />, permission: PERMISSIONS.REPORTS_VIEW },
  { path: "/promotions", element: <PromotionsPage />, permission: PERMISSIONS.PROMOTIONS_MANAGE },
  { path: "/branches", element: <SalonBranches />, permission: PERMISSIONS.SETTINGS_MANAGE },
];

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="wesd-theme">
        <ColorThemeProvider>
        <CurrencyProvider>
          <PricingProvider>
            <ImpersonationProvider>
              <AuthProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <ImpersonationBanner />
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

                {/* Salon / Market / Boutique Routes */}
                {(["salon", "market", "boutique"] as const).flatMap(prefix =>
                  salonAdminRoutes.map(route => (
                    <Route
                      key={`${prefix}/${route.path}`}
                      path={`/${prefix}${route.path}`}
                        element={
                          <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole requiredPermissions={route.permission}>
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

                {/* Stationery Routes */}
                <Route
                  path="/stationery"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole requiredPermissions={PERMISSIONS.DASHBOARD_VIEW}>
                      <StationeryDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/stationery/products"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole requiredPermissions={PERMISSIONS.PRODUCTS_READ}>
                      <StationeryProducts />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/stationery/categories"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole requiredPermissions={PERMISSIONS.CATEGORIES_MANAGE}>
                      <StationeryCategories />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/stationery/customers"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole requiredPermissions={PERMISSIONS.CLIENTS_READ}>
                      <StationeryCustomers />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/stationery/suppliers"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole requiredPermissions={PERMISSIONS.SUPPLIERS_READ}>
                      <StationerySuppliers />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/stationery/purchases"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole requiredPermissions={PERMISSIONS.PURCHASES_MANAGE}>
                      <StationeryPurchases />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/stationery/sales"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole requiredPermissions={PERMISSIONS.SALES_TODAY}>
                      <StationerySales />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/stationery/pos"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole requiredPermissions={PERMISSIONS.POS_VIEW}>
                      <StationeryPOS />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/stationery/expenses"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole requiredPermissions={PERMISSIONS.EXPENSES_MANAGE}>
                      <StationeryExpenses />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/stationery/inventory"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole requiredPermissions={PERMISSIONS.STOCK_VIEW}>
                      <StationeryInventory />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/stationery/reports"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole requiredPermissions={PERMISSIONS.REPORTS_VIEW}>
                      <StationeryReports />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/stationery/settings"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole requiredPermissions={PERMISSIONS.SETTINGS_MANAGE}>
                      <StationerySettings />
                    </ProtectedRoute>
                  }
                />


                {/* School Routes */}
                <Route path="/school/teacher-login" element={<TeacherLogin />} />
                <Route element={<SchoolProviderWrapper />}>
                  <Route
                    path="/school"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "school_admin", "school_accountant", "school_cashier", "school_teacher"]} allowAuthenticatedWithoutRole>
                      <SchoolDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/teacher/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={["school_teacher"]} allowAuthenticatedWithoutRole>
                      <TeacherDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/teacher/grades"
                  element={
                    <ProtectedRoute allowedRoles={["school_teacher"]} allowAuthenticatedWithoutRole>
                      <TeacherGrades />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/teacher/attendance"
                  element={
                    <ProtectedRoute allowedRoles={["school_teacher"]} allowAuthenticatedWithoutRole>
                      <TeacherAttendance />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/staff"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "school_admin", "school_accountant", "school_cashier", "school_teacher"]} requiredPermissions="staff" allowAuthenticatedWithoutRole>
                      <SchoolStaff />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/settings"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "school_admin", "school_accountant", "school_cashier", "school_teacher"]} requiredPermissions="settings" allowAuthenticatedWithoutRole>
                      <SchoolSettings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/settings/builder"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "school_admin", "school_accountant", "school_cashier", "school_teacher"]} requiredPermissions="settings" allowAuthenticatedWithoutRole>
                      <ReportBuilder />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/academic-years"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "school_admin", "school_accountant", "school_cashier", "school_teacher"]} requiredPermissions="academic_years" allowAuthenticatedWithoutRole>
                      <SchoolAcademicYears />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/classes"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "school_admin", "school_accountant", "school_cashier", "school_teacher"]} requiredPermissions="classes" allowAuthenticatedWithoutRole>
                      <SchoolClasses />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/subjects"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "school_admin", "school_accountant", "school_cashier", "school_teacher"]} requiredPermissions="classes" allowAuthenticatedWithoutRole>
                      <SchoolSubjects />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/fees"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "school_admin", "school_accountant", "school_cashier", "school_teacher"]} requiredPermissions="fees" allowAuthenticatedWithoutRole>
                      <SchoolFees />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/students"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "school_admin", "school_accountant", "school_cashier", "school_teacher"]} requiredPermissions="students" allowAuthenticatedWithoutRole>
                      <SchoolStudents />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/attendance"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "school_admin", "school_accountant", "school_cashier", "school_teacher"]} requiredPermissions="students" allowAuthenticatedWithoutRole>
                      <SchoolAttendance />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/timetables"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "school_admin", "school_accountant", "school_cashier", "school_teacher"]} requiredPermissions="classes" allowAuthenticatedWithoutRole>
                      <SchoolTimetables />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/grades"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "school_admin", "school_accountant", "school_cashier", "school_teacher"]} requiredPermissions="classes" allowAuthenticatedWithoutRole>
                      <SchoolGrades />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/enrollments"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "school_admin", "school_accountant", "school_cashier", "school_teacher"]} requiredPermissions="enrollments" allowAuthenticatedWithoutRole>
                      <EnrollmentsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/finance/student"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "school_admin", "school_accountant", "school_cashier", "school_teacher"]} requiredPermissions="finance_student" allowAuthenticatedWithoutRole>
                      <StudentFinancialSheet />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/parents"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "school_admin", "school_accountant", "school_cashier", "school_teacher"]} requiredPermissions="parents" allowAuthenticatedWithoutRole>
                      <SchoolParents />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/teachers"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "school_admin", "school_accountant", "school_cashier", "school_teacher"]} requiredPermissions="teachers" allowAuthenticatedWithoutRole>
                      <SchoolTeachers />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/invoices"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "school_admin", "school_accountant", "school_cashier", "school_teacher"]} requiredPermissions="invoices" allowAuthenticatedWithoutRole>
                      <SchoolInvoices />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/payments"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "school_admin", "school_accountant", "school_cashier", "school_teacher"]} requiredPermissions="payments" allowAuthenticatedWithoutRole>
                      <SchoolPayments />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/expenses"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "school_admin", "school_accountant", "school_cashier", "school_teacher"]} requiredPermissions="expenses" allowAuthenticatedWithoutRole>
                      <SchoolExpenses />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/school/payroll"
                  element={
                    <ProtectedRoute allowedRoles={["salon_admin", "school_admin", "school_accountant", "school_cashier", "school_teacher"]} requiredPermissions="expenses" allowAuthenticatedWithoutRole>
                      <SchoolPayroll />
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
                </Route>

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
            </ImpersonationProvider>
          </PricingProvider>
        </CurrencyProvider>
        </ColorThemeProvider>
      </ThemeProvider>
    </QueryClientProvider>
    <Suspense fallback={null}>
      <OfflineBanner />
      <PWAInstallPrompt />
    </Suspense>
  </ErrorBoundary>
);

export default App;
