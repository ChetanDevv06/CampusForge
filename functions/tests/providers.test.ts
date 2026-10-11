import { describe, expect, it } from "vitest";
import {
  getProviderAdapter,
  isProviderOutcome,
  loadProviderConfigs,
  PROVIDER_ADAPTERS,
  PROVIDER_NOT_CONFIGURED,
  resolveProgramIdForCollege,
} from "../src/providers";
import type { ProviderConfig } from "../src/verification";
import type { CollegeConfig } from "../src/types";
import {
  verifyCallbackAuth,
  type CallbackAuthConfig,
} from "../src/callback-auth";

const providerConfigs: ProviderConfig[] = [
  {
    providerId: "testprovider",
    programMappings: { rvce: "PROG_RVCE_1", iitb: "PROG_IITB_1" },
    secret: "server-secret",
    webhookSecret: "callback-secret",
  },
];

function college(overrides: Partial<CollegeConfig> = {}): CollegeConfig {
  return {
    name: "RV College of Engineering",
    shortName: "RVCE",
    domain: "rvce.edu.in",
    domains: ["rvce.edu.in"],
    location: "Bengaluru",
    logo: null,
    verified: true,
    memberCount: 10,
    createdAt: null,
    verificationEnabled: true,
    verificationProviderId: "testprovider",
    verificationProgramId: null,
    verificationMethod: "provider_redirect",
    ...overrides,
  };
}

describe("provider registry is fail-closed", () => {
  it("only exposes the stub adapter by default", () => {
    expect(PROVIDER_ADAPTERS.map((a) => a.providerId)).toEqual(["stub"]);
    expect(getProviderAdapter("sheerid")).toBeNull();
  });

  it("stub initiate throws instead of returning a fake redirect", async () => {
    const stub = getProviderAdapter("stub")!;
    await expect(
      stub.initiate({
        userId: "u",
        collegeId: "c",
        attemptId: "a",
        programId: "p",
        redirectUri: "x",
      }),
    ).rejects.toThrow(PROVIDER_NOT_CONFIGURED);
  });

  it("stub never reports an approved status", async () => {
    const stub = getProviderAdapter("stub")!;
    expect(
      await stub.getStatus({ attemptId: "a", providerReference: "r", programId: "p" }),
    ).toBeNull();
    expect(
      await stub.handleCallback({
        rawBody: "{}",
        signature: null,
        attemptId: "a",
        providerReference: "r",
        programId: "p",
      }),
    ).toBeNull();
  });

  it("accepts only documented provider outcomes", () => {
    expect(isProviderOutcome("approved")).toBe(true);
    expect(isProviderOutcome("REJECTED")).toBe(false);
    expect(isProviderOutcome("verified")).toBe(false);
    expect(isProviderOutcome("")).toBe(false);
  });
});

describe("provider program resolution", () => {
  it("resolves the program id for a configured college", () => {
    const resolved = resolveProgramIdForCollege("rvce", college(), providerConfigs);
    expect(resolved).toEqual({ providerId: "testprovider", programId: "PROG_RVCE_1" });
  });

  it("fails closed for an unconfigured college", () => {
    const resolved = resolveProgramIdForCollege("unknown", college(), providerConfigs);
    expect(resolved.programId).toBeNull();
  });

  it("never falls back to another college's program", () => {
    // A client-asserted college id must not silently map onto some other
    // college's program.
    const resolved = resolveProgramIdForCollege("vt u", college(), providerConfigs);
    expect(resolved.programId).toBeNull();
  });

  it("fails closed when the provider is not configured server-side", () => {
    const resolved = resolveProgramIdForCollege("rvce", college(), []);
    expect(resolved).toEqual({ providerId: "testprovider", programId: null });
  });

  it("fails closed for manual-review colleges", () => {
    const manual = college({
      verificationProviderId: null,
      verificationMethod: "manual_review",
    });
    expect(resolveProgramIdForCollege("rvce", manual, providerConfigs)).toEqual({
      providerId: null,
      programId: null,
    });
  });
});

describe("provider configuration loading", () => {
  it("returns nothing when the secret is absent", () => {
    const previous = process.env.VERIFICATION_PROVIDERS;
    delete process.env.VERIFICATION_PROVIDERS;
    expect(loadProviderConfigs()).toEqual([]);
    process.env.VERIFICATION_PROVIDERS = previous;
  });

  it("fails closed on malformed configuration", () => {
    const previous = process.env.VERIFICATION_PROVIDERS;
    process.env.VERIFICATION_PROVIDERS = "{not json";
    expect(loadProviderConfigs()).toEqual([]);
    process.env.VERIFICATION_PROVIDERS = previous;
  });

  it("parses a valid configuration array", () => {
    const previous = process.env.VERIFICATION_PROVIDERS;
    process.env.VERIFICATION_PROVIDERS = JSON.stringify(providerConfigs);
    expect(loadProviderConfigs()).toHaveLength(1);
    process.env.VERIFICATION_PROVIDERS = previous;
  });
});

describe("provider callback authentication", () => {
  const body = JSON.stringify({ eventId: "evt_1", status: "approved" });

  function sign(secret: string, payload: string, timestamp?: number): string {
    // Mirrors the documented scheme: HMAC-SHA256 over "<ts>.<rawBody>".
    // Computed here with plain hashing to keep the fixture honest.
    const { createHmac } = require("crypto") as typeof import("crypto");
    return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  }

  const config: CallbackAuthConfig = {
    mode: "hmac",
    webhookSecret: "callback-secret",
    toleranceSeconds: 300,
  };

  it("rejects a missing configuration", () => {
    const result = verifyCallbackAuth({
      config: null,
      rawBody: body,
      headers: {},
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("callback_authentication_not_configured");
  });

  it("rejects an unsigned callback", () => {
    const result = verifyCallbackAuth({ config, rawBody: body, headers: {} });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("missing_signature");
  });

  it("rejects a callback signed with the wrong secret", () => {
    const result = verifyCallbackAuth({
      config,
      rawBody: body,
      headers: { "x-campusforge-signature": sign("wrong-secret", body) },
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("invalid_signature");
  });

  it("rejects a tampered payload", () => {
    const signature = sign("callback-secret", body);
    const result = verifyCallbackAuth({
      config,
      rawBody: JSON.stringify({ eventId: "evt_1", status: "approved", injected: true }),
      headers: { "x-campusforge-signature": signature },
    });
    expect(result.ok).toBe(false);
  });

  it("accepts a correctly signed callback", () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = sign("callback-secret", `${timestamp}.${body}`);
    const result = verifyCallbackAuth({
      config,
      rawBody: body,
      headers: {
        "x-campusforge-signature": signature,
        "x-campusforge-timestamp": String(timestamp),
      },
      nowSeconds: timestamp,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a stale signed callback", () => {
    const timestamp = Math.floor(Date.now() / 1000) - 3600;
    const signature = sign("callback-secret", `${timestamp}.${body}`);
    const result = verifyCallbackAuth({
      config,
      rawBody: body,
      headers: {
        "x-campusforge-signature": signature,
        "x-campusforge-timestamp": String(timestamp),
      },
      nowSeconds: Math.floor(Date.now() / 1000),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("stale_signature");
  });

  it("supports bearer-token callbacks", () => {
    const bearerConfig: CallbackAuthConfig = {
      mode: "bearer",
      bearerToken: "shared-token",
    };
    expect(
      verifyCallbackAuth({
        config: bearerConfig,
        rawBody: body,
        headers: { authorization: "Bearer shared-token" },
      }).ok,
    ).toBe(true);
    expect(
      verifyCallbackAuth({
        config: bearerConfig,
        rawBody: body,
        headers: { authorization: "Bearer nope" },
      }).ok,
    ).toBe(false);
  });
});
