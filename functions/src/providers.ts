/**
 * Provider adapter layer.
 *
 * IMPORTANT — no real provider integration is configured in this build.
 * The registry below is fail-closed: every adapter operation throws or returns
 * null until a real adapter is implemented, registered and configured with
 * production credentials and confirmed college-program coverage.
 *
 * Verification therefore cannot succeed through an unconfigured provider, and
 * membership can only ever be activated from a validated provider result or an
 * explicit admin adjudication.
 *
 * To add a real provider:
 *  1. Create `src/providers/<name>.ts` implementing `ProviderAdapter`.
 *  2. Register it in `PROVIDER_ADAPTERS`.
 *  3. Configure it server-side (environment / secret manager), never in the app.
 *  4. Confirm partner-college program coverage before enabling the college.
 */

import {
  ProviderConfig,
  ProviderVerificationResult,
} from "./verification";
import { CollegeConfig, VerificationOutcome } from "./types";

export const PROVIDER_NOT_CONFIGURED = "VERIFICATION_PROVIDER_NOT_CONFIGURED";

/** Outcome values a provider may report. Anything else is rejected. */
export const PROVIDER_OUTCOMES: readonly VerificationOutcome[] = [
  "approved",
  "rejected",
  "inconclusive",
  "needs_action",
];

export function isProviderOutcome(value: unknown): value is VerificationOutcome {
  return (
    typeof value === "string" &&
    (PROVIDER_OUTCOMES as readonly string[]).includes(value)
  );
}

export interface ProviderAdapter {
  readonly providerId: string;

  /** Build the redirect URL / launch target for a verification attempt. */
  initiate(input: {
    userId: string;
    collegeId: string;
    attemptId: string;
    programId: string;
    redirectUri: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ redirectUrl: string; providerReference: string }>;

  /** Authoritative server-side status retrieval. */
  getStatus(input: {
    attemptId: string;
    providerReference: string;
    programId: string;
  }): Promise<ProviderVerificationResult | null>;

  /** Validate an inbound provider event (signature + attempt binding). */
  handleCallback(input: {
    rawBody: string;
    signature: string | null;
    attemptId: string;
    providerReference: string;
    programId: string;
  }): Promise<ProviderVerificationResult | null>;
}

/**
 * Fail-closed stub. Implementations for real providers must replace this and
 * must never return `approved` without a validated provider response.
 */
class StubProviderAdapter implements ProviderAdapter {
  readonly providerId = "stub";

  async initiate(): Promise<{ redirectUrl: string; providerReference: string }> {
    throw new Error(PROVIDER_NOT_CONFIGURED);
  }

  async getStatus(): Promise<ProviderVerificationResult | null> {
    return null;
  }

  async handleCallback(): Promise<ProviderVerificationResult | null> {
    return null;
  }
}

export const PROVIDER_ADAPTERS: ProviderAdapter[] = [new StubProviderAdapter()];

export function getProviderAdapter(providerId: string): ProviderAdapter | null {
  return PROVIDER_ADAPTERS.find((a) => a.providerId === providerId) || null;
}

/**
 * Server-managed provider configurations.
 *
 * These are loaded from the function's environment (Cloud Secret Manager in
 * production) and are deliberately NOT prefixed with EXPO_PUBLIC_ — provider
 * credentials must never be bundled into the React Native application.
 *
 * Expected shape of the `VERIFICATION_PROVIDERS` JSON secret:
 * [
 *   {
 *     "providerId": "stub",
 *     "programMappings": { "<collegeId>": "<providerProgramId>" },
 *     "secret": "<server-side-only credential>",
 *     "webhookSecret": "<callback signing secret>",
 *     "initiateEndpoint": "https://...",
 *     "statusEndpoint": "https://..."
 *   }
 * ]
 */
export function loadProviderConfigs(): ProviderConfig[] {
  const configs: ProviderConfig[] = [];
  const raw = process.env.VERIFICATION_PROVIDERS;
  if (!raw) return configs;
  try {
    const parsed = JSON.parse(raw) as ProviderConfig[];
    if (Array.isArray(parsed)) configs.push(...parsed);
  } catch {
    // Fail closed: malformed configuration means no provider is usable.
  }
  return configs;
}

export function isProviderEnabled(): boolean {
  return loadProviderConfigs().length > 0;
}

export function resolveProviderConfig(providerId: string): ProviderConfig | null {
  return loadProviderConfigs().find((c) => c.providerId === providerId) || null;
}

/**
 * Resolve the provider program id for a college.
 *
 * The program id is read ONLY from the admin-controlled college document; a
 * client-supplied value is never accepted, and no fallback mapping is used —
 * an unknown college, an unconfigured provider or a missing mapping all return
 * null so that verification fails closed.
 */
export function resolveProgramIdForCollege(
  collegeId: string,
  college: CollegeConfig,
  providerConfigs: ProviderConfig[],
): { providerId: string | null; programId: string | null } {
  const providerId = college.verificationProviderId;
  if (!providerId) return { providerId: null, programId: null };

  const config = providerConfigs.find((c) => c.providerId === providerId);
  if (!config) return { providerId, programId: null };

  const programId = config.programMappings[collegeId] ?? null;
  return { providerId, programId };
}

export { PROVIDER_NOT_CONFIGURED as PROVIDER_STUB_DISABLED };
