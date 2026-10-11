import { describe, expect, it } from "vitest";
import { parseBearerToken } from "../src/bearer-token";

describe("parseBearerToken", () => {
  it("extracts a token", () => {
    expect(parseBearerToken("Bearer abc123")).toBe("abc123");
  });

  it("is case-insensitive on the scheme", () => {
    expect(parseBearerToken("bearer abc123")).toBe("abc123");
    expect(parseBearerToken("BEARER abc123")).toBe("abc123");
    expect(parseBearerToken("BeArEr abc123")).toBe("abc123");
  });

  it("tolerates extra whitespace after the scheme", () => {
    expect(parseBearerToken("Bearer   abc123")).toBe("abc123");
    expect(parseBearerToken("Bearer\tabc123")).toBe("abc123");
    expect(parseBearerToken("  Bearer abc123  ")).toBe("abc123");
  });

  it("takes the first value of a repeated header", () => {
    expect(parseBearerToken(["Bearer abc123", "Bearer other"])).toBe("abc123");
  });

  it("rejects a missing or empty header", () => {
    expect(parseBearerToken(undefined)).toBeNull();
    expect(parseBearerToken("")).toBeNull();
    expect(parseBearerToken([])).toBeNull();
  });

  it("rejects a header with no token", () => {
    expect(parseBearerToken("Bearer")).toBeNull();
    expect(parseBearerToken("Bearer ")).toBeNull();
    expect(parseBearerToken("Bearer   ")).toBeNull();
  });

  it("rejects other schemes", () => {
    expect(parseBearerToken("Basic dXNlcjpwYXNzd29yZA==")).toBeNull();
    expect(parseBearerToken("Token abc123")).toBeNull();
    expect(parseBearerToken("abc123")).toBeNull();
  });

  it("rejects a scheme glued to the token", () => {
    // "Bearerabc" must not be read as scheme + token.
    expect(parseBearerToken("Bearerabc")).toBeNull();
    expect(parseBearerToken("Bearerabc xyz")).toBeNull();
  });

  it("keeps whitespace inside the token intact", () => {
    expect(parseBearerToken("Bearer token with spaces")).toBe(
      "token with spaces",
    );
  });

  it("handles the backtracking-shaped input without hanging", () => {
    // /^Bearer\\s+(.+)$/i is ambiguous between `\\s+` and `(.+)` over spaces,
    // so this input used to cost quadratic time. Parsing is linear here.
    const hostile = `Bearer${" ".repeat(200_000)}`;
    const started = Date.now();
    expect(parseBearerToken(hostile)).toBeNull();
    expect(Date.now() - started).toBeLessThan(1000);

    const hostileNewline = `Bearer${"\n".repeat(200_000)}`;
    expect(parseBearerToken(hostileNewline)).toBeNull();
  });
});
