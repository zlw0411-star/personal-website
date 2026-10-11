import { notFound } from "next/navigation";
import { headers } from "next/headers";
import AdminShell from "@/components/admin/AdminShell";
import AdminLogin from "@/components/admin/AdminLogin";
import { getAdminAccessState } from "@/lib/server/admin-auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const rawHost = requestHeaders.get("host");
  let host = "";
  if (rawHost && !/[\s/@?#\\]/u.test(rawHost) && !rawHost.endsWith(":")) {
    try {
      const parsed = new URL(`http://${rawHost}`);
      if (!parsed.username && !parsed.password && parsed.pathname === "/" && !parsed.search && !parsed.hash) {
        host = parsed.hostname.toLowerCase();
      }
    } catch {
      // Invalid host headers are rejected by the empty-host check below.
    }
  }
  if (!import.meta.env.DEV || !host || !["localhost", "127.0.0.1", "[::1]"].includes(host)) notFound();
  const access = await getAdminAccessState(requestHeaders.get("cookie"));
  if (!access.authenticated) return <AdminLogin configured={access.configured}/>;
  return <AdminShell>{children}</AdminShell>;
}
