import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Product } from "@/lib/types";

export interface LocalCartLine {
  product: Product;
  quantity: number;
  note?: string;
}

interface CartState {
  storeId: string | null;
  lines: LocalCartLine[];
  addItem: (product: Product, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
  subtotal: () => number;
}

// Cart is scoped to a single store at a time, matching how OTLOB checkout
// works (one order per store). Adding from a different store clears the
// previous cart — mirrors web/src/store/cart-store.ts exactly.
export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      storeId: null,
      lines: [],
      addItem: (product, quantity = 1) => {
        const { storeId, lines } = get();
        if (storeId && storeId !== product.storeId) {
          set({ storeId: product.storeId, lines: [{ product, quantity }] });
          return;
        }
        const existing = lines.find((l) => l.product.id === product.id);
        if (existing) {
          set({
            lines: lines.map((l) =>
              l.product.id === product.id ? { ...l, quantity: l.quantity + quantity } : l
            ),
          });
        } else {
          set({ storeId: product.storeId, lines: [...lines, { product, quantity }] });
        }
      },
      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }
        set({
          lines: get().lines.map((l) => (l.product.id === productId ? { ...l, quantity } : l)),
        });
      },
      removeItem: (productId) => {
        const remaining = get().lines.filter((l) => l.product.id !== productId);
        set({ lines: remaining, storeId: remaining.length ? get().storeId : null });
      },
      clear: () => set({ storeId: null, lines: [] }),
      subtotal: () => get().lines.reduce((sum, l) => sum + l.product.price * l.quantity, 0),
    }),
    {
      name: "otlob-cart",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
