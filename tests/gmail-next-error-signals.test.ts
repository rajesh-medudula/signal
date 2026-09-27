import { describe, expect, it } from "vitest";
import { notFound, redirect } from "next/navigation";
import { isNextNotFoundSignal } from "@/lib/channels/gmail/next-error-signals";

/**
 * Deliberately does NOT mock next/navigation — this proves the
 * detection matches what notFound()/redirect() actually throw in the
 * Next version this repo pins, not a shape we merely assumed.
 */
describe("isNextNotFoundSignal (against real next/navigation signals)", () => {
  it("returns true for a real thrown notFound()", () => {
    let caught: unknown;
    try {
      notFound();
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(isNextNotFoundSignal(caught)).toBe(true);
  });

  it("returns false for a real thrown redirect()", () => {
    let caught: unknown;
    try {
      redirect("/somewhere");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(isNextNotFoundSignal(caught)).toBe(false);
  });

  it("returns false for an ordinary error and other non-signal values", () => {
    expect(isNextNotFoundSignal(new Error("boom"))).toBe(false);
    expect(isNextNotFoundSignal(null)).toBe(false);
    expect(isNextNotFoundSignal(undefined)).toBe(false);
    expect(isNextNotFoundSignal("boom")).toBe(false);
    expect(isNextNotFoundSignal({ digest: 123 })).toBe(false);
    expect(isNextNotFoundSignal({ digest: "NEXT_REDIRECT;push;/x;307;" })).toBe(
      false,
    );
  });
});
