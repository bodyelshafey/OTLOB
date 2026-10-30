import React, { useEffect } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import * as authApi from "@/lib/endpoints/auth";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/Button";
import { colors, fonts } from "@/theme";
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
//
// expo-auth-session's Google.useAuthRequest() THROWS during render if the
// client ID for the CURRENT platform is undefined (it only looks at
// iosClientId on iOS, androidClientId on Android, webClientId elsewhere).
// Hooks can't be called conditionally, so the hook lives in
// ConfiguredGoogleSignInButton below and is only mounted once the current
// platform's ID is present. This wrapper decides which one to render.

// Empty / whitespace-only values (e.g. "EXPO_PUBLIC_...=" in .env.local) are
// treated as "not set".
function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

// EXPO_PUBLIC_* vars must be referenced as literal `process.env.NAME`
// expressions so Metro/EAS can inline them at build time.
const iosClientId = clean(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);
const androidClientId = clean(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID);
const webClientId = clean(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);

// Mirrors the platform selection inside expo-auth-session's Google provider.
const CURRENT_PLATFORM_ENV_VAR = Platform.select({
  ios: "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID",
  android: "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID",
  default: "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID",
});
const CURRENT_PLATFORM_CLIENT_ID = Platform.select({
  ios: iosClientId,
  android: androidClientId,
  default: webClientId,
});

export function GoogleSignInButton() {
  const isConfigured = !!CURRENT_PLATFORM_CLIENT_ID;

  useEffect(() => {
    if (!isConfigured && __DEV__) {
      console.warn(
        `[GoogleSignIn] ${CURRENT_PLATFORM_ENV_VAR} is not set, so Google ` +
          `Sign-In cannot start on ${Platform.OS}. Create the OAuth client ` +
          `in Google Cloud Console, add its ID to apps/app/.env.local ` +
          `(and to the eas.json "env" block for EAS builds), then restart ` +
          `with: npx expo start -c`
      );
    }
  }, [isConfigured]);

  if (isConfigured) return <ConfiguredGoogleSignInButton />;

  // Production builds without an ID keep the original "render nothing"
  // behaviour. In development we show a visible, disabled button plus the
  // reason, so it never looks like Google Sign-In silently vanished.
  if (!__DEV__) return null;

  return (
    <View style={{ marginTop: 12 }}>
      <Button
        title={t("auth.continueWithGoogle")}
        variant="outline"
        onPress={() => {}}
        disabled
      />
      <Text style={styles.devNotice}>
        {`Dev: set ${CURRENT_PLATFORM_ENV_VAR} to enable Google Sign-In on ${Platform.OS}.`}
      </Text>
    </View>
  );
}

function ConfiguredGoogleSignInButton() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

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

const styles = StyleSheet.create({
  devNotice: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkMuted,
    textAlign: "center",
    marginTop: 6,
  },
});
