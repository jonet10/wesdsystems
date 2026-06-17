import fs from 'fs';

const file = 'C:/Users/herod/OneDrive/Desktop/WesdSystems/src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

// The marker we know is correct and uncorrupted
const startMarker = '<AutoPartsReports />';

// We will split the file at the startMarker, then find the end of the corrupted block:
const parts = content.split(startMarker);
if (parts.length === 2) {
  let bottomPart = parts[1];
  
  // Find the exact line where `{/* Auto Parts Routes */}` occurs.
  const endMarker = '{/* Auto Parts Routes */}';
  const endIdx = bottomPart.indexOf(endMarker);
  
  if (endIdx !== -1) {
    // Keep everything after `{/* Auto Parts Routes */}`
    bottomPart = bottomPart.substring(endIdx);
    
    // Now we construct the correct chunk between `<AutoPartsReports />` and `{/* Auto Parts Routes */}`
    const correctChunk = `
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
                `;
                
    const newContent = parts[0] + startMarker + correctChunk + bottomPart;
    fs.writeFileSync(file, newContent, 'utf8');
    console.log('Successfully fixed App.tsx');
  } else {
    console.log('Could not find endMarker');
  }
} else {
  console.log('Could not find startMarker');
}
