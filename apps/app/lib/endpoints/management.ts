import api from "@/lib/api";

export function getStoreEmployees(storeId: string) {
  return api.get(`/stores/${storeId}/employees`).then((r) => r.data);
}
export function addStoreEmployee(
  storeId: string,
  payload: { userId: string; role: "CASHIER" | "MANAGER" }
) {
  return api.post(`/stores/${storeId}/employees`, payload).then((r) => r.data);
}
export function removeStoreEmployee(storeId: string, memberId: string) {
  return api.delete(`/stores/${storeId}/employees/${memberId}`);
}

export function getStoreReport(storeId: string) {
  return api.get(`/reports/store/${storeId}`).then((r) => r.data);
}
export function getPlatformReport() {
  return api.get("/reports/platform").then((r) => r.data);
}

export function getUsers(params?: { page?: number; limit?: number }) {
  return api.get("/users", { params }).then((r) => r.data);
}
export function getUser(id: string) {
  return api.get(`/users/${id}`).then((r) => r.data);
}

export function createStoreType(payload: { name: string; nameAr?: string; icon?: string }) {
  return api.post("/store-types", payload).then((r) => r.data);
}
export function deleteStoreType(id: string) {
  return api.delete(`/store-types/${id}`);
}
