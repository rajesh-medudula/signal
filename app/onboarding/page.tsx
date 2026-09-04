import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guard";
import { resolveActiveBusiness } from "@/lib/business/context";
import { AuthShell } from "@/components/auth/AuthShell";
import { OnboardingForm } from "@/components/business/OnboardingForm";

export const metadata = {
  title: "Set up your business — Signal",
};

export default async function OnboardingPage() {
  const user = await requireUser();

  // Already onboarded — most commonly a refresh after a successful
  // submit, or a stale bookmark/back-navigation to this page. Send
  // them straight into the dashboard rather than re-showing the form.
  const existing = await resolveActiveBusiness(user);
  if (existing) {
    redirect("/dashboard");
  }

  return (
    <AuthShell
      title="Set up your business"
      description="One more step — this is what your team will see."
      footer="You can change this later."
    >
      <OnboardingForm />
    </AuthShell>
  );
}
