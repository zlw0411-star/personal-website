import { notFound } from "next/navigation";
import { headers } from "next/headers";
import AdminShell from "@/components/admin/AdminShell";
import AdminLogin from "@/components/admin/AdminLogin";
import { getAdminAccessState } from "@/lib/server/admin-auth";
import { isAdminOriginAllowed, layoutRequestOrigin } from "@/lib/server/runtime-config";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  if (!isAdminOriginAllowed(layoutRequestOrigin(requestHeaders))) notFound();
  const access = await getAdminAccessState(requestHeaders.get("cookie"));
  if (!access.authenticated) return <AdminLogin configured={access.configured}/>;
  return <AdminShell>{children}</AdminShell>;
}
