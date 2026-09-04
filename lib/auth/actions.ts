"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/db/supabase/server";

export interface AuthActionState {
  error: string | null;
}

export interface SignUpActionState extends AuthActionState {
  /** True once Supabase has sent a confirmation email and there's
   * nothing further to do server-side — the sign-up form switches to a
   * "check your email" message instead of redirecting. */
  awaitingConfirmation: boolean;
}

function readCredentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  return { email, password };
}

/** Same generic message for both failure modes below, so a failed
 * sign-up never tells a visitor whether an email is already registered. */
const GENERIC_SIGNUP_ERROR = "Couldn't create your account. Try again.";

export async function signUpAction(
  _prevState: SignUpActionState,
  formData: FormData,
): Promise<SignUpActionState> {
  const { email, password } = readCredentials(formData);

  if (!email || !password) {
    return {
      error: "Enter an email and password.",
      awaitingConfirmation: false,
    };
  }

  if (password.length < 8) {
    return {
      error: "Password must be at least 8 characters.",
      awaitingConfirmation: false,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: GENERIC_SIGNUP_ERROR, awaitingConfirmation: false };
  }

  // Supabase returns a user with no identities, and no error, when the
  // email already belongs to a confirmed account — this keeps that case
  // indistinguishable from a genuine new sign-up.
  if (data.user && data.user.identities?.length === 0) {
    return { error: null, awaitingConfirmation: true };
  }

  if (data.session) {
    // Email confirmation is disabled for this project — the account is
    // usable immediately. New accounts have no business yet, so send
    // them to onboarding rather than a dashboard that would just
    // redirect them there anyway.
    redirect("/onboarding");
  }

  return { error: null, awaitingConfirmation: true };
}

export async function signInAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const { email, password } = readCredentials(formData);

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Deliberately doesn't distinguish "no such account" from "wrong
    // password" — either detail helps someone probing for valid emails.
    return { error: "Incorrect email or password." };
  }

  redirect("/dashboard");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
