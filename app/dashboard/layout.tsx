import { requireUser } from "@/lib/auth/guard";
import { resolveActiveBusiness } from "@/lib/business/context";
import { redirect } from "next/navigation";
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

  // Every dashboard request needs a real, verified business context —
  // not just an authenticated identity. A user with zero businesses
  // (freshly signed up, or an existing account from before Module 2B)
  // goes to onboarding instead of an empty/broken dashboard.
  const context = await resolveActiveBusiness(user);
  if (!context) {
    redirect("/onboarding");
  }

  return (
    <div className="flex min-h-full">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <TopBar userEmail={user.email} businessName={context.business.name} />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
