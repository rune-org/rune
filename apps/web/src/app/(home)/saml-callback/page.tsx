"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { samlExchange } from "@/lib/api/auth";
import { REFRESH_TOKEN_KEY, ACCESS_EXP_KEY } from "@/lib/auth/constants";

const ERROR_MESSAGES: Record<string, string> = {
  no_config: "No active SSO configuration found. Contact your administrator.",
  assertion_invalid:
    "The identity provider response could not be verified. Please try again or contact your administrator.",
  account_disabled: "Your account has been disabled. Contact your administrator.",
};

const FALLBACK_ERROR = "An unexpected SSO error occurred. Please try signing in again.";

// ---------------------------------------------------------------------------
// Redirect sanitisation — mirrors the backend _safe_redirect_path guard
// ---------------------------------------------------------------------------

function sanitizeRedirect(raw: string | null): string {
  if (!raw) return "/create";
  const path = raw.trim();
  // Reject protocol-relative and absolute URLs
  if (path.startsWith("//") || path.includes("://")) return "/create";
  // Must be a relative path starting with /
  if (!path.startsWith("/")) return "/create";
  // Reject any attempt to target the callback page itself (loop prevention)
  if (path === "/saml-callback" || path.startsWith("/saml-callback?")) return "/create";
  return path;
}

// ---------------------------------------------------------------------------
// Inner component — uses useSearchParams (requires Suspense boundary above)
// ---------------------------------------------------------------------------

type Phase = "loading" | "error";

function SamlCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh, refetchProfile } = useAuth();

  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Guard against React double-invoke in Strict Mode / concurrent renders
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const status = searchParams.get("status");
    const reason = searchParams.get("reason");
    const code = searchParams.get("code");
    const redirectParam = searchParams.get("redirect");

    // -----------------------------------------------------------------------
    // 1. Clean URL — strip all SSO params from browser history immediately.
    //    Tokens / codes must never sit in the address bar or Referer header.
    // -----------------------------------------------------------------------
    window.history.replaceState(null, "", "/saml-callback");

    // -----------------------------------------------------------------------
    // 2. Backend-signalled error — map reason to a friendly message
    // -----------------------------------------------------------------------
    if (status === "error") {
      setErrorMessage(ERROR_MESSAGES[reason ?? ""] ?? FALLBACK_ERROR);
      setPhase("error");
      return;
    }

    // -----------------------------------------------------------------------
    // 3. No code present → invalid / direct browser visit
    // -----------------------------------------------------------------------
    if (!code) {
      setErrorMessage(FALLBACK_ERROR);
      setPhase("error");
      return;
    }

    // -----------------------------------------------------------------------
    // 4. Sanitize redirect before making any network call
    // -----------------------------------------------------------------------
    const target = sanitizeRedirect(redirectParam);

    // -----------------------------------------------------------------------
    // 5. Exchange the one-time code for real credentials
    // -----------------------------------------------------------------------
    async function exchangeCode() {
      try {
        const response = await samlExchange(code!);
        const payload = response.data?.data;

        if (!payload) {
          setErrorMessage(FALLBACK_ERROR);
          setPhase("error");
          return;
        }

        // -------------------------------------------------------------------
        // 6. Persist tokens — exactly mirrors AuthProvider.login()
        //    - refresh_token  → localStorage[auth:refresh_token]
        //    - access_exp_ms  → localStorage[auth:access_exp]
        //    - access_token   → already set as httpOnly cookie by the exchange endpoint
        // -------------------------------------------------------------------
        try {
          localStorage.setItem(REFRESH_TOKEN_KEY, payload.refresh_token);
          localStorage.setItem(ACCESS_EXP_KEY, String(Date.now() + payload.expires_in * 1000));
        } catch {
          // Silently degrade in private-browsing / restricted environments.
          // The session will still work for the current tab via the cookie.
        }

        // -------------------------------------------------------------------
        // 7. Wire up the auto-refresh timer and validate the new session by
        //    going through the AuthContext — identical path to normal login.
        // -------------------------------------------------------------------
        await refresh();
        await refetchProfile();

        // -------------------------------------------------------------------
        // 8. Navigate to the post-login destination
        // -------------------------------------------------------------------
        router.replace(target);
      } catch {
        setErrorMessage(FALLBACK_ERROR);
        setPhase("error");
      }
    }

    void exchangeCode();
    // searchParams is stable across the lifetime of this effect; refresh /
    // refetchProfile / router are stable refs from their respective hooks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === "error") {
    return (
      <AuthCard
        title="Sign-in Failed"
        description={errorMessage}
        footer={
          <span>
            Need help?{" "}
            <a
              href="mailto:support@rune.dev"
              className="text-white hover:underline underline-offset-4 transition-all"
            >
              Contact support
            </a>
          </span>
        }
      >
        <Button asChild size="lg" className="w-full">
          <Link href="/sign-in">Back to Sign In</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Signing you in…" description="Completing SSO authentication, please wait.">
      <div className="flex items-center justify-center py-6">
        <div
          className="size-8 animate-spin rounded-full border-2 border-white/20 border-t-white"
          role="status"
          aria-label="Authenticating"
        />
      </div>
    </AuthCard>
  );
}

function LoadingFallback() {
  return (
    <AuthCard title="Signing you in…" description="Completing SSO authentication, please wait.">
      <div className="flex items-center justify-center py-6">
        <div
          className="size-8 animate-spin rounded-full border-2 border-white/20 border-t-white"
          role="status"
          aria-label="Authenticating"
        />
      </div>
    </AuthCard>
  );
}

export default function SamlCallbackPage() {
  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center py-12 px-4">
      {/* Ambient gradient — matches the sign-in page aesthetic */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(120,119,198,0.1)_0%,transparent_100%)]" />
      </div>

      <Suspense fallback={<LoadingFallback />}>
        <SamlCallbackContent />
      </Suspense>
    </div>
  );
}
