import api from "@/lib/api";
import type { AuthUser } from "@/store/authStore";

interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

// Returned by register/verifyEmail/verifyPhone whenever the account still
// has an outstanding verification step — no tokens yet, see
// AuthService.register on the backend.
interface PendingVerificationResponse {
  message: string;
  email: string;
  phone: string;
  emailVerified: boolean;
  phoneVerified: boolean;
}

// PIVOTED 2026-09-13: `identifier` (not `email`) — matched against phone
// first, email second, on the backend. See LoginDto's comment: a couple of
// pre-existing accounts have no phone on file and can only log in by
// email, so the backend accepts either through one field. The login
// SCREEN still shows "Phone Number" as the primary field.
export function login(identifier: string, password: string) {
  return api
    .post<AuthResponse>("/auth/login", { identifier, password })
    .then((r) => r.data);
}

// PIVOTED 2026-09-13: registration is phone+password only now — no email
// field at all. Email became a fully optional step added later via
// addEmail() below. Never returns tokens directly — the caller must
// complete verifyRegistrationPhone first (now the ONLY verification step,
// not "step 1 of 2").
export function register(payload: {
  fullName: string;
  phone: string;
  password: string;
}) {
  return api
    .post<{ message: string; phone: string; phoneVerified: boolean }>("/auth/register", payload)
    .then((r) => r.data);
}

// Dormant as of the 2026-09-13 pivot — email is no longer part of
// registration. Left in place (not deleted) in case a future phase wires
// email verification back in for the optional addEmail() step.
export function verifyEmail(email: string, code: string) {
  return api
    .post<AuthResponse | PendingVerificationResponse>("/auth/verify-email", { email, code })
    .then((r) => r.data);
}

export function resendVerification(email: string) {
  return api.post<{ message: string }>("/auth/resend-verification", { email }).then((r) => r.data);
}

// Public, pre-auth — the ONLY registration verification step as of the
// 2026-09-13 pivot (was "step 2 of 2" identified by email; now identified
// by `phone` directly, since email isn't collected at registration at
// all). Issues tokens immediately on success. For verifying a phone added
// AFTER login (e.g. a Google Sign-In account), see verifyAddedPhone below
// instead.
export function verifyRegistrationPhone(phone: string, code: string) {
  return api
    .post<AuthResponse>("/auth/verify-phone", { phone, code })
    .then((r) => r.data);
}

export function resendRegistrationPhoneCode(phone: string) {
  return api.post<{ message: string }>("/auth/resend-phone-code", { phone }).then((r) => r.data);
}

// The optional "Add your email" step (2026-09-13) — authenticated (JWT),
// reachable right after phone verification (Skip-able) or later from
// account settings. No OTP — this phase's product decision is that email
// verification is not required, only phone is.
export function addEmail(email: string) {
  return api.post<{ message: string; email: string }>("/auth/email/add", { email }).then((r) => r.data);
}

export function googleLogin(idToken: string) {
  return api
    .post<AuthResponse & { phoneVerificationRequired: boolean }>("/auth/google", { idToken })
    .then((r) => r.data);
}

// --- phone add/change on an ALREADY-AUTHENTICATED account (e.g. a Google
// Sign-In user completing their phone afterward). JWT-protected, distinct
// routes from the public registration ones above.

export function addPhone(phone: string) {
  return api
    .post<{ message: string; phone: string }>("/auth/phone/add", { phone })
    .then((r) => r.data);
}

export function verifyAddedPhone(code: string) {
  return api
    .post<{ message: string; phoneVerified: true }>("/auth/phone/verify", { code })
    .then((r) => r.data);
}

export function resendAddedPhoneCode() {
  return api.post<{ message: string }>("/auth/phone/resend").then((r) => r.data);
}

export function forgotPassword(email: string) {
  return api.post<{ message: string }>("/auth/forgot-password", { email }).then((r) => r.data);
}

export function resetPassword(email: string, code: string, newPassword: string) {
  return api
    .post<{ message: string }>("/auth/reset-password", { email, code, newPassword })
    .then((r) => r.data);
}

export function logout() {
  return api.post("/auth/logout");
}

export function getMe() {
  return api.get<AuthUser>("/users/me").then((r) => r.data);
}

// Note: `phone` is intentionally not editable here — see UpdateUserDto on
// the backend. Phone changes go through addPhone/verifyAddedPhone above
// instead, since a plain profile PATCH has no way to (re-)verify the new
// number.
export function updateMe(payload: Partial<Pick<AuthUser, "fullName" | "avatar">>) {
  return api.patch<AuthUser>("/users/me", payload).then((r) => r.data);
}
