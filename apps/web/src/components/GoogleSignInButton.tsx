'use client';

import { useCallback, useEffect, useRef } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

// Renders Google's own "Sign in with Google" button (via Google Identity
// Services) and, once the person picks an account, sends the resulting ID
// token to POST /auth/google — the backend verifies it server-side, so this
// component never has to know whether the result is a login, a fresh
// account, or a linked existing account.
export default function GoogleSignInButton({ redirect = '/' }: { redirect?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const init = useCallback(() => {
    if (!clientId || !window.google || !containerRef.current) return;

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response) => {
        try {
          const { data } = await api.post('/auth/google', { idToken: response.credential });
          setAuth(data.user, data.accessToken, data.refreshToken);
          // Google verifies email for us, but never hands us a phone number
          // — see AuthService.googleAuth. If this account still needs one,
          // send them to complete it (they're already authenticated at
          // this point, so /account/add-phone uses the JWT-protected
          // /auth/phone/* endpoints, not the public registration ones).
          if (data.phoneVerificationRequired) {
            router.push(`/account/add-phone?redirect=${encodeURIComponent(redirect)}`);
          } else {
            router.push(redirect);
          }
        } catch {
          // Silent — this button has no error UI slot; a failed Google
          // sign-in just leaves the person on the login page, where they
          // can fall back to email/password.
        }
      },
    });
    window.google.accounts.id.renderButton(containerRef.current, {
      theme: 'outline',
      size: 'large',
      width: 320,
      text: 'continue_with',
      locale: 'ar',
    });
  }, [clientId, redirect, router, setAuth]);

  // Handles client-side navigation between pages that both use this
  // component (e.g. /login <-> /register) — the GSI <script> only loads
  // once per full page load, so a later mount needs to re-init directly
  // instead of waiting for a Script onLoad that will never fire again.
  useEffect(() => {
    if (window.google) init();
  }, [init]);

  if (!clientId) return null;

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={init} />
      <div ref={containerRef} className="flex justify-center" />
    </>
  );
}
