"use client";

import { useActionState } from "react";
import {
  onboardBusinessAction,
  type OnboardBusinessActionState,
} from "@/lib/business/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const initialState: OnboardBusinessActionState = { error: null };

export function OnboardingForm() {
  const [state, formAction, isPending] = useActionState(
    onboardBusinessAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="businessName"
          className="text-[13px] font-medium text-text-secondary"
        >
          Business name
        </label>
        <Input
          id="businessName"
          name="businessName"
          type="text"
          autoComplete="organization"
          maxLength={120}
          required
        />
      </div>

      {state.error ? (
        <p role="alert" className="text-[13px] text-danger">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending} className="mt-1 w-full">
        {isPending ? "Creating…" : "Create business"}
      </Button>
    </form>
  );
}
