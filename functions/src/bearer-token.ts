/**
 * Authorization header parsing shared by both transports.
 *
 * This is deliberately implemented with string operations rather than a
 * regular expression. A pattern like /^Bearer\s+(.+)$/i is ambiguous over
 * whitespace — `\s+` and `(.+)` can both consume spaces — so matching a
 * hostile header made of "bearer" followed by thousands of spaces requires
 * quadratic backtracking. CodeQL flags this as js/polynomial-redos, and it is
 * reachable by anyone who can set an Authorization header.
 *
 * RFC 6750 defines the scheme as `Bearer` followed by 1*SP. Tabs are accepted
 * as well so existing clients keep working.
 */

export function parseBearerToken(
  header: string | string[] | undefined,
): string | null {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) return null;

  const trimmed = value.trim();
  if (trimmed.slice(0, 6).toLowerCase() !== "bearer") return null;

  // The scheme must be followed by whitespace, not more identifier
  // characters: "Bearerabc" is not an Authorization header.
  const separator = trimmed.charAt(6);
  if (separator !== " " && separator !== "\t") return null;

  const token = trimmed.slice(7).trim();
  return token.length > 0 ? token : null;
}
