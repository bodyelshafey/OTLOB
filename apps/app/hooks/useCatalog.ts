import { useQuery } from "@tanstack/react-query";
import * as catalog from "@/lib/endpoints/catalog";

export function useStoreTypes() {
  return useQuery({ queryKey: ["store-types"], queryFn: catalog.getStoreTypes });
}

export function useStores(params?: {
  limit?: number;
  storeTypeId?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ["stores", params],
    queryFn: () => catalog.getStores(params),
  });
}

export function useStore(id: string | undefined) {
  return useQuery({
    queryKey: ["store", id],
    queryFn: () => catalog.getStore(id as string),
    enabled: !!id,
  });
}

export function useCategories(storeId: string | undefined) {
  return useQuery({
    queryKey: ["categories", storeId],
    queryFn: () => catalog.getCategories(storeId as string),
    enabled: !!storeId,
  });
}

export function useProducts(params: { storeId?: string; categoryId?: string; limit?: number }) {
  return useQuery({
    queryKey: ["products", params],
    queryFn: () => catalog.getProducts(params),
    enabled: !!params.storeId || !!params.categoryId,
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ["product", id],
    queryFn: () => catalog.getProduct(id as string),
    enabled: !!id,
  });
}
