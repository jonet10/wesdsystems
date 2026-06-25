import fs from 'fs';
import path from 'path';

const appTsxPath = path.join(process.cwd(), 'src/App.tsx');
let content = fs.readFileSync(appTsxPath, 'utf8');

// Replace salonAdminRoutes definition
content = content.replace(
  `const salonAdminRoutes: { path: string; element: JSX.Element }[] = [
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
];`,
  `const salonAdminRoutes: { path: string; element: JSX.Element; permission?: Permission }[] = [
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
];`
);

// Replace salonAdminRoutes usage
content = content.replace(
  `        {salonAdminRoutes.map((route, i) => (
          <Route
            key={i}
            path={\`/salon\${route.path}\`}
            element={
              <ProtectedRoute allowedRoles={["salon_admin"]} allowAuthenticatedWithoutRole>
                {route.element}
              </ProtectedRoute>
            }
          />
        ))}`,
  `        {salonAdminRoutes.map((route, i) => (
          <Route
            key={i}
            path={\`/salon\${route.path}\`}
            element={
              <ProtectedRoute allowedRoles={["salon_admin", "employee"]} requiredPermissions={route.permission} allowAuthenticatedWithoutRole>
                {route.element}
              </ProtectedRoute>
            }
          />
        ))}`
);

fs.writeFileSync(appTsxPath, content);
console.log('App.tsx updated');

// Now update ProtectedRoute.tsx
const protectedRoutePath = path.join(process.cwd(), 'src/components/auth/ProtectedRoute.tsx');
let prContent = fs.readFileSync(protectedRoutePath, 'utf8');

prContent = prContent.replace(
  `  // Employee sessions are handled separately from Supabase auth.
  if (hasEmployeeSession) {
    const path = location.pathname;
    const isEmployeePosRoute = path === "/salon/pos" || path === "/employee/pos";
    const isEmployeeReportsRoute = path === "/salon/reports";
    const isEmployeeRoute = path.startsWith("/employee");

    if (isEmployeePosRoute && canAccessEmployeePos(employeeSession?.role)) {
      return <>{children}</>;
    }

    if (isEmployeeReportsRoute && (employeeRole === "cashier" || employeeRole === "manager")) {
      return <>{children}</>;
    }

    if (isEmployeeRoute) {
      return <>{children}</>;
    }

    return <Navigate to="/employee" replace />;
  }`,
  `  // Employee sessions are handled separately from Supabase auth.
  if (hasEmployeeSession) {
    const routePath = location.pathname;
    const isEmployeeRoute = routePath.startsWith("/employee");

    if (isEmployeeRoute) {
      return <>{children}</>;
    }

    if (requiredPermissions && employeeRole) {
      const empPerms = getSalonEmployeePermissions(employeeRole);
      const permsToCheck = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
      const hasPerm = permsToCheck.some(p => empPerms.includes(p));
      
      if (hasPerm) {
        return <>{children}</>;
      }
    }
    
    // Default fallback if they don't have the permission
    return <Navigate to="/employee" replace />;
  }`
);

prContent = prContent.replace(
  `import { canAccessEmployeePos, normalizeEmployeeRole } from "@/lib/employee-role";`,
  `import { normalizeEmployeeRole } from "@/lib/employee-role";
import { getSalonEmployeePermissions } from "@/config/permissions";`
);

fs.writeFileSync(protectedRoutePath, prContent);
console.log('ProtectedRoute.tsx updated');
