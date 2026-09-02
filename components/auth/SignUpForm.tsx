"use client";

import { useActionState } from "react";
import { signUpAction, type SignUpActionState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const initialState: SignUpActionState = {
  error: null,
  awaitingConfirmation: false,
};

export function SignUpForm() {
  const [state, formAction, isPending] = useActionState(
    signUpAction,
    initialState,
  );

  if (state.awaitingConfirmation) {
    return (
      <p className="text-[13px] leading-relaxed text-text-secondary">
        Check your email for a link to confirm your account.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="email"
          className="text-[13px] font-medium text-text-secondary"
        >
          Email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="password"
          className="text-[13px] font-medium text-text-secondary"
        >
          Password
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <p className="text-[12px] text-text-tertiary">
          At least 8 characters.
        </p>
      </div>

      {state.error ? (
        <p role="alert" className="text-[13px] text-danger">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending} className="mt-1 w-full">
        {isPending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
