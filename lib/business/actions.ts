"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guard";
import { createSupabaseServerClient } from "@/lib/db/supabase/server";
import { getMembershipForBusiness } from "@/lib/business/queries";
import { ACTIVE_BUSINESS_COOKIE } from "@/lib/business/context";

export interface OnboardBusinessActionState {
  error: string | null;
}

const ACTIVE_BUSINESS_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

/**
 * Creates the caller's first business and owner membership together
 * via `onboard_business()` (see the Module 2B migration) — a single
 * database function call, not multiple round trips from here, so
 * there's no window where a business could exist without an owner.
 * That function is itself idempotent per user, so a duplicate submit
 * (double click, refreshed form, retried network failure) resolves to
 * the same business rather than creating a second one.
 */
export async function onboardBusinessAction(
  _prevState: OnboardBusinessActionState,
  formData: FormData,
): Promise<OnboardBusinessActionState> {
  await requireUser();

  const businessName = String(formData.get("businessName") ?? "").trim();

  if (!businessName) {
    return { error: "Enter a business name." };
  }

  if (businessName.length > 120) {
    return { error: "Business name must be 120 characters or fewer." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .rpc("onboard_business", { business_name: businessName })
    .single<{ id: string }>();

  if (error || !data) {
    return { error: "Couldn't create your business. Please try again." };
  }

  const cookieStore = await cookies();
  cookieStore.set(
    ACTIVE_BUSINESS_COOKIE,
    data.id,
    ACTIVE_BUSINESS_COOKIE_OPTIONS,
  );

  redirect("/dashboard");
}

/**
 * Switches which business the caller's session operates in. Verifies
 * membership in `businessId` before writing the cookie — the cookie is
 * only ever a hint about which *already-verified* business to show by
 * default (see `resolveActiveBusiness`), never itself treated as proof
 * of access.
 */
export async function setActiveBusinessAction(
  businessId: string,
): Promise<{ error: string | null }> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const membership = await getMembershipForBusiness(
    supabase,
    user.id,
    businessId,
  );

  if (!membership) {
    return { error: "You don't have access to that business." };
  }

  const cookieStore = await cookies();
  cookieStore.set(
    ACTIVE_BUSINESS_COOKIE,
    businessId,
    ACTIVE_BUSINESS_COOKIE_OPTIONS,
  );

  return { error: null };
}
