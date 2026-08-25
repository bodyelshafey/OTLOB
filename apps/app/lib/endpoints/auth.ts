import api from "@/lib/api";
import type { AuthUser } from "@/store/authStore";

interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

interface RegisterResponse {
  message: string;
  email: string;
  requiresVerification: true;
}

export function login(email: string, password: string) {
  return api
    .post<AuthResponse>("/auth/login", { email, password })
    .then((r) => r.data);
}

export function register(payload: {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}) {
  return api.post<RegisterResponse>("/auth/register", payload).then((r) => r.data);
}

export function verifyEmail(email: string, code: string) {
  return api.post<AuthResponse>("/auth/verify-email", { email, code }).then((r) => r.data);
}

export function resendVerification(email: string) {
  return api.post<{ message: string }>("/auth/resend-verification", { email }).then((r) => r.data);
}

export function logout() {
  return api.post("/auth/logout");
}

export function getMe() {
  return api.get<AuthUser>("/users/me").then((r) => r.data);
}

export function updateMe(payload: Partial<Pick<AuthUser, "fullName" | "phone" | "avatar">>) {
  return api.patch<AuthUser>("/users/me", payload).then((r) => r.data);
}
