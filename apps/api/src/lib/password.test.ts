import { describe, expect, it } from "vitest";
import { hashPassword, PBKDF2_ITERATIONS, verifyPassword } from "./password";

const PEPPER = "test-pepper-value";

describe("password hashing", () => {
  it("round-trips and uses the Workers-safe iteration count", async () => {
    const h = await hashPassword("correct horse battery", PEPPER);
    expect(h.startsWith(`pbkdf2$${PBKDF2_ITERATIONS}$`)).toBe(true);
    expect(PBKDF2_ITERATIONS).toBeLessThanOrEqual(100_000); // Workers hard cap
    expect(await verifyPassword("correct horse battery", PEPPER, h)).toBe(true);
  });

  it("rejects a wrong password and a wrong pepper", async () => {
    const h = await hashPassword("correct horse battery", PEPPER);
    expect(await verifyPassword("wrong", PEPPER, h)).toBe(false);
    expect(await verifyPassword("correct horse battery", "other-pepper", h)).toBe(false);
  });

  it("salts every hash differently", async () => {
    const a = await hashPassword("same", PEPPER);
    const b = await hashPassword("same", PEPPER);
    expect(a).not.toBe(b);
  });

  it("rejects malformed stored values instead of throwing", async () => {
    expect(await verifyPassword("x", PEPPER, "not-a-hash")).toBe(false);
    expect(await verifyPassword("x", PEPPER, "bcrypt$1$a$b")).toBe(false);
  });
});
