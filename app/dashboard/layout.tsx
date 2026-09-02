import { requireUser } from "@/lib/auth/guard";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { TopBar } from "@/components/dashboard/TopBar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolves the signed-in user server-side and redirects to /sign-in
  // before any of the markup below renders — an unauthenticated request
  // never receives dashboard content.
  const user = await requireUser();

  return (
    <div className="flex min-h-full">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <TopBar userEmail={user.email} />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
