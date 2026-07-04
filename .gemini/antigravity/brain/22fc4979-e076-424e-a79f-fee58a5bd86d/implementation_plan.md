# Fix Employee RLS Bypass Architecture

The root cause of the "Row-Level Security (RLS) violation" errors for Employees logging in via PIN is a structural flaw:
- Employees logging in via PIN do not have a Supabase `auth.uid()`.
- RLS policies (like `salon_sales_tenant_guard`) strictly rely on `current_user_business_id()`, which only looks at `auth.uid()`.
- Therefore, if an Employee logs in without an active Admin session on the same device, all `supabase.from()` queries are executed anonymously, causing RLS to block all `INSERT`, `UPDATE`, and `SELECT` queries.

## Proposed Changes

We will modify the core Supabase client to inject the employee session token into the HTTP headers, and update the database to recognize this header to authorize the user.

### 1. Update Supabase Client (`src/lib/supabase.ts`)
[MODIFY] `src/lib/supabase.ts`
- Implement a `customFetch` function that reads `wesd_salon_employee` from `localStorage`.
- Inject a custom HTTP header `x-employee-session` containing the token into every Supabase request.
- Pass this `customFetch` to the `createClient` global options.

### 2. Update Database Security Context
[NEW] `supabase/migrations/20260903_employee_jwt_rls_bridge.sql`
- Redefine `public.current_user_business_id()` to check for the custom HTTP header.
- If `auth.uid()` is null, the function will attempt to read `x-employee-session` from `current_setting('request.headers', true)`.
- It will validate the token hash against the `employee_sessions` table and return the correct `business_id` if valid.

## Verification Plan

### Manual Verification
- Log out of all accounts.
- Log in explicitly as an Employee via the `/auth/login` PIN screen.
- Verify that the POS dashboard loads products correctly.
- Attempt to create a new client and process a sale.
- Ensure no RLS violation toasts appear.

> [!IMPORTANT]
> This architectural change will ensure that Employees can fully use the system on dedicated POS tablets without requiring an Admin to remain logged in. Please review and approve this plan.
