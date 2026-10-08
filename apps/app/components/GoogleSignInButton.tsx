import React, { useEffect } from "react";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import * as authApi from "@/lib/endpoints/auth";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/Button";
import { t } from "@/i18n";

// Required once per app, at module scope, so the in-app browser used for
// the Google OAuth screen closes itself and hands control back to the app
// after the redirect — otherwise the browser sheet just sits there.
WebBrowser.maybeCompleteAuthSession();

// Google issues a separate OAuth client ID per platform (iOS bundle ID /
// Android package name / generic "Web" client used as the fallback) —
// these three env vars are NOT interchangeable with apps/api's
// GOOGLE_CLIENT_ID or apps/web's NEXT_PUBLIC_GOOGLE_CLIENT_ID, even though
// they all belong to the same Google Cloud project/OAuth consent screen.
// Renders nothing if none are configured, so this is a safe no-op until
// someone sets them up in Google Cloud Console + EAS build env.
export function GoogleSignInButton() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId,
    androidClientId,
    webClientId,
  });

  useEffect(() => {
    if (response?.type !== "success") return;
    const idToken = response.authentication?.idToken ?? (response.params as any)?.id_token;
    if (!idToken) return;

    authApi
      .googleLogin(idToken)
      .then((data) => {
        setAuth(data.user, data.accessToken, data.refreshToken);
        // Google verifies email for us but never hands us a phone number
        // — see AuthService.googleAuth on the backend.
        if (data.phoneVerificationRequired) {
          router.replace("/(auth)/add-phone");
        } else {
          router.replace("/(tabs)");
        }
      })
      .catch(() => {
        // Silent — same reasoning as the web button: no dedicated error
        // slot here, person can fall back to email/password.
      });
    // response is a new object identity on every render even when its
    // content hasn't changed, so depending on response.type + the token
    // itself (not the whole response) avoids re-firing this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response?.type]);

  if (!webClientId && !iosClientId && !androidClientId) return null;

  return (
    <Button
      title={t("auth.continueWithGoogle")}
      variant="outline"
      onPress={() => promptAsync()}
      disabled={!request}
      style={{ marginTop: 12 }}
    />
  );
}
