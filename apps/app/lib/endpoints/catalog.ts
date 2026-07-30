import api from "@/lib/api";
import type { StoreType, Store, Category, Product, Paginated } from "@/lib/types";

export function getStoreTypes() {
  return api.get<StoreType[]>("/store-types").then((r) => r.data);
}

export function getStores(params?: {
  limit?: number;
  storeTypeId?: string;
  search?: string;
}) {
  return api
    .get<Paginated<Store>>("/stores", { params })
    .then((r) => r.data.items ?? []);
}

export function getMyStore() {
  return api.get<Store>("/stores/mine").then((r) => r.data);
}

export function getStore(id: string) {
  return api.get<Store>(`/stores/${id}`).then((r) => r.data);
}

export function createStore(payload: Partial<Store>) {
  return api.post<Store>("/stores", payload).then((r) => r.data);
}

export function updateStore(id: string, payload: Partial<Store>) {
  return api.patch<Store>(`/stores/${id}`, payload).then((r) => r.data);
}

export function toggleStoreOpen(id: string) {
  return api.patch<Store>(`/stores/${id}/toggle-open`).then((r) => r.data);
}

export function getCategories(storeId?: string, storeTypeId?: string) {
  return api
    .get<Category[]>("/categories", { params: { storeId, storeTypeId } })
    .then((r) => r.data);
}

export function createCategory(payload: {
  nameAr: string;
  nameEn: string;
  storeTypeId: string;
  storeId?: string;
}) {
  return api.post<Category>("/categories", payload).then((r) => r.data);
}

export function deleteCategory(id: string) {
  return api.delete(`/categories/${id}`);
}

export function getProducts(params: {
  storeId?: string;
  categoryId?: string;
  limit?: number;
}) {
  return api
    .get<Paginated<Product>>("/products", { params })
    .then((r) => r.data.items ?? []);
}

export function getProduct(id: string) {
  return api.get<Product>(`/products/${id}`).then((r) => r.data);
}

export function createProduct(payload: Partial<Product>) {
  return api.post<Product>("/products", payload).then((r) => r.data);
}

export function updateProduct(id: string, payload: Partial<Product>) {
  return api.patch<Product>(`/products/${id}`, payload).then((r) => r.data);
}

export function deleteProduct(id: string) {
  return api.delete(`/products/${id}`);
}
