import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";
import {
  EMPTY_STATUS,
  SafeVerificationStatus,
  cancelVerification as cancelVerificationRequest,
  getVerificationStatus,
  retryVerification,
  startVerification,
  submitAppeal,
  VerificationState,
} from "../utils/verification";
import { useAuth } from "./AuthContext";

interface VerificationContextType {
  status: SafeVerificationStatus;
  /** True while the first authoritative status read is in flight. */
  isLoading: boolean;
  /** Set when the last backend call failed (provider error, rate limit, …). */
  error: { code: string; message: string; verificationCode?: string } | null;
  collegeId: string | null;
  verificationState: VerificationState;
  hasCampusAccess: boolean;
  refresh: () => Promise<void>;
  start: () => Promise<string | null>;
  retry: () => Promise<string | null>;
  appeal: (reason: string) => Promise<void>;
  cancel: () => Promise<void>;
  clearError: () => void;
}

const VerificationContext = createContext<VerificationContextType>({
  status: EMPTY_STATUS,
  isLoading: true,
  error: null,
  collegeId: null,
  verificationState: "not_started",
  hasCampusAccess: false,
  refresh: async () => {},
  start: async () => null,
  retry: async () => null,
  appeal: async () => {},
  cancel: async () => {},
  clearError: () => {},
});

export const useVerification = () => useContext(VerificationContext);

export function VerificationProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [status, setStatus] = useState<SafeVerificationStatus>(EMPTY_STATUS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<VerificationContextType["error"]>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const collegeId = profile?.collegeId ?? null;

  const clearError = useCallback(() => setError(null), []);

  /**
   * Authoritative read. Called on sign-in, on app start, after any action and
   * whenever the mirrored profile changes — never relying on cached state.
   */
  const refresh = useCallback(async () => {
    if (!user?.uid) {
      setStatus(EMPTY_STATUS);
      setIsLoading(false);
      return;
    }
    try {
      const response = await getVerificationStatus(collegeId);
      setStatus(response.status);
      setError(null);
    } catch (err) {
      setError(err as VerificationContextType["error"]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid, collegeId]);

  // Re-check on sign-in / account switch / college change.
  useEffect(() => {
    setIsLoading(true);
    setStatus(EMPTY_STATUS);
    void refresh();
  }, [user?.uid, collegeId, refresh]);

  // Live updates: mirror of the backend-owned verification status on the
  // profile, so a decision made while the app is open is applied immediately.
  useEffect(() => {
    if (!user?.uid) return;
    const ref = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        const mirror = snapshot.data()?.verificationStatus as
          | VerificationState
          | undefined;
        if (!mirror) return;
        setStatus((current) =>
          current.status === mirror ? current : { ...current, status: mirror },
        );
      },
      () => {
        // A permission or connectivity failure must not grant access; the
        // mirrored value is only an optimisation.
      },
    );
    unsubscribeRef.current = unsubscribe;
    return () => {
      unsubscribe();
      unsubscribeRef.current = null;
    };
  }, [user?.uid]);

  // Clearing user-specific state on sign-out / account switching.
  useEffect(() => {
    if (!user) {
      setStatus(EMPTY_STATUS);
      setError(null);
      setIsLoading(false);
    }
  }, [user]);

  const start = useCallback(async (): Promise<string | null> => {
    if (!collegeId) return null;
    try {
      clearError();
      const response = await startVerification(collegeId);
      setStatus(response.status);
      setError(null);
      return response.redirectUrl ?? null;
    } catch (err) {
      const error = err as VerificationContextType["error"];
      setError(error);
      // Re-thrown so the screen can surface immediate feedback (a modal)
      // instead of silently returning null.
      throw err;
    }
  }, [collegeId, clearError]);

  const retry = useCallback(async (): Promise<string | null> => {
    if (!collegeId) return null;
    try {
      clearError();
      const response = await retryVerification(collegeId);
      setStatus(response.status);
      setError(null);
      return response.redirectUrl ?? null;
    } catch (err) {
      setError(err as VerificationContextType["error"]);
      throw err;
    }
  }, [collegeId, clearError]);

  const appeal = useCallback(
    async (reason: string) => {
      if (!collegeId) return;
      try {
        clearError();
        const response = await submitAppeal(collegeId, reason);
        setStatus(response.status);
        setError(null);
      } catch (err) {
        setError(err as VerificationContextType["error"]);
        throw err;
      }
    },
    [collegeId, clearError],
  );

  const cancel = useCallback(async () => {
    if (!collegeId) return;
    try {
      clearError();
      await cancelVerificationRequest(collegeId);
      await refresh();
      setError(null);
    } catch (err) {
      setError(err as VerificationContextType["error"]);
      throw err;
    }
  }, [collegeId, refresh, clearError]);

  const value = useMemo<VerificationContextType>(
    () => ({
      status,
      isLoading,
      error,
      collegeId,
      verificationState: status.status,
      hasCampusAccess: status.hasCampusAccess,
      refresh,
      start,
      retry,
      appeal,
      cancel,
      clearError,
    }),
    [status, isLoading, error, collegeId, refresh, start, retry, appeal, cancel, clearError],
  );

  return (
    <VerificationContext.Provider value={value}>
      {children}
    </VerificationContext.Provider>
  );
}

export { EMPTY_STATUS };
export type { SafeVerificationStatus };
