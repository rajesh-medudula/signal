import { describe, expect, it } from "vitest";
import { NotImplementedError } from "@/lib/errors";

describe("NotImplementedError", () => {
  it("includes the feature name in its message", () => {
    const error = new NotImplementedError("Gmail connector");

    expect(error.message).toContain("Gmail connector");
    expect(error.name).toBe("NotImplementedError");
    expect(error).toBeInstanceOf(Error);
  });
});
