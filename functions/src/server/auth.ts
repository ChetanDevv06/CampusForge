/**
 * Firebase Auth + App Check middleware for the self-hosted HTTP transport.
 *
 * The transport authenticates requests with the same Firebase ID tokens the
 * mobile app already holds, so the backend stays authoritative: a caller
 * cannot reach any verification or membership operation without a valid token.
 */

import type { NextFunction, Request, RequestHandler, Response } from "express";
import { getAppCheck } from "firebase-admin/app-check";
import { getAuth } from "firebase-admin/auth";
import { getDb } from "../db";

export interface AuthedUser {
  uid: string;
  admin: boolean;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthedUser;
    }
  }
}

export interface HttpErrorBody {
  error: {
    message: string;
    status: HttpStatus;
    /** Machine-readable code the mobile app branches on. */
    details?: { verificationCode?: string };
  };
}

export type HttpStatus =
  | "ok"
  | "invalid-argument"
  | "unauthenticated"
  | "permission-denied"
  | "failed-precondition"
  | "resource-exhausted"
  | "unavailable"
  | "internal";

const HTTP_STATUS_CODES: Record<HttpStatus, number> = {
  ok: 200,
  "invalid-argument": 400,
  unauthenticated: 401,
  "permission-denied": 403,
  "failed-precondition": 412,
  "resource-exhausted": 429,
  unavailable: 503,
  internal: 500,
};

export function errorBody(
  status: HttpStatus,
  message: string,
  verificationCode?: string,
): HttpErrorBody {
  return {
    error: {
      message,
      status,
      ...(verificationCode ? { details: { verificationCode } } : {}),
    },
  };
}

export function httpStatusFor(status: HttpStatus): number {
  return HTTP_STATUS_CODES[status];
}

function bearerToken(header: string | string[] | undefined): string | null {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) return null;
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

async function hasAdminRole(uid: string): Promise<boolean> {
  try {
    const snapshot = await getDb().doc(`users/${uid}`).get();
    return snapshot.data()?.role === "admin";
  } catch {
    return false;
  }
}

/**
 * Verifies the Firebase ID token and (optionally) the App Check token.
 * Rejects the request before any handler runs when either is missing or invalid.
 */
export const authenticate: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token = bearerToken(req.headers.authorization);
  if (!token) {
    res
      .status(401)
      .json(errorBody("unauthenticated", "Sign in to continue."));
    return;
  }

  try {
    const appCheckToken = (req.headers["x-firebase-appcheck"] as string) ?? "";
    if (process.env.REQUIRE_APP_CHECK === "1") {
      await getAppCheck().verifyToken(appCheckToken);
    } else if (appCheckToken) {
      // Opportunistically verify, but never trust it as the only control.
      await getAppCheck().verifyToken(appCheckToken).catch(() => undefined);
    }

    const decoded = await getAuth().verifyIdToken(token);
    const admin = decoded.admin === true || (await hasAdminRole(decoded.uid));
    req.auth = { uid: decoded.uid, admin };
    next();
  } catch {
    res
      .status(401)
      .json(errorBody("unauthenticated", "Your session expired. Please sign in again."));
  }
};

/** Blocks non-admin callers. Must run after `authenticate`. */
export const requireAdmin: RequestHandler = (req, res, next) => {
  if (!req.auth?.admin) {
    res
      .status(403)
      .json(errorBody("permission-denied", "Administrator access required."));
    return;
  }
  next();
};
