import type { ReactNode } from "react";

import { RequireAdmin } from "@/components/auth/RequireAdmin";

/**
 * Admin Layout
 *
 * Wraps all routes under /admin/* with a centralized admin role check.
 * This prevents code duplication and ensures no admin page can be rendered
 * without proper authorization.
 *
 * All admin pages now automatically inherit this guard without needing to
 * implement their own useEffect-based checks.
 */

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return <RequireAdmin>{children}</RequireAdmin>;
}
