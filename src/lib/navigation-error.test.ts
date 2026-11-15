import { notFound, redirect } from "next/navigation";
import { describe, expect, it } from "vitest";
import { isNavigationSignal } from "./navigation-error";

const thrownBy = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error("expected a throw");
};

describe("isNavigationSignal", () => {
  it("recognises redirect and notFound", () => {
    expect(isNavigationSignal(thrownBy(() => redirect("/app")))).toBe(true);
    expect(isNavigationSignal(thrownBy(() => notFound()))).toBe(true);
  });

  it("treats other errors as failures", () => {
    expect(isNavigationSignal(new Error("failed"))).toBe(false);
    expect(isNavigationSignal("failed")).toBe(false);
    expect(isNavigationSignal(undefined)).toBe(false);
  });
});
