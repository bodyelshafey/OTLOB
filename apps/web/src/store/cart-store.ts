import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product, Offer } from '@/types';

// A line is either a regular product or an offer — never both. Kept as two
// optional fields (instead of a union) so existing call sites that only
// ever dealt with `.product` keep working unchanged.
export interface LocalCartLine {
  product?: Product;
  offer?: Offer;
  quantity: number;
  note?: string;
}

// Shared accessors so screens don't need to branch on product/offer everywhere.
export function lineId(line: LocalCartLine): string {
  return (line.product?.id ?? line.offer?.id)!;
}
export function lineName(line: LocalCartLine): string {
  return line.product?.name ?? line.offer?.titleAr ?? '';
}
export function lineImage(line: LocalCartLine): string | undefined {
  return (line.product?.image ?? line.offer?.image) ?? undefined;
}
export function linePrice(line: LocalCartLine): number {
  if (line.product) return line.product.price;
  return Number(line.offer?.newPrice ?? line.offer?.oldPrice ?? 0);
}

interface CartState {
  storeId: string | null;
  lines: LocalCartLine[];
  addItem: (product: Product, quantity?: number) => void;
  addOffer: (offer: Offer, quantity?: number) => void;
  updateQuantity: (lineItemId: string, quantity: number) => void;
  removeItem: (lineItemId: string) => void;
  clear: () => void;
  subtotal: () => number;
}

// Cart is scoped to a single store at a time, matching how OTLOB checkout works
// (one order per store). Adding from a different store clears the previous cart.
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
        const existing = lines.find((l) => l.product?.id === product.id);
        if (existing) {
          set({
            lines: lines.map((l) =>
              l.product?.id === product.id ? { ...l, quantity: l.quantity + quantity } : l,
            ),
          });
        } else {
          set({ storeId: product.storeId, lines: [...lines, { product, quantity }] });
        }
      },
      addOffer: (offer, quantity = 1) => {
        const offerStoreId = offer.storeId ?? offer.store?.id;
        if (!offerStoreId) return;
        const { storeId, lines } = get();
        if (storeId && storeId !== offerStoreId) {
          set({ storeId: offerStoreId, lines: [{ offer, quantity }] });
          return;
        }
        const existing = lines.find((l) => l.offer?.id === offer.id);
        if (existing) {
          set({
            lines: lines.map((l) =>
              l.offer?.id === offer.id ? { ...l, quantity: l.quantity + quantity } : l,
            ),
          });
        } else {
          set({ storeId: offerStoreId, lines: [...lines, { offer, quantity }] });
        }
      },
      updateQuantity: (lineItemId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(lineItemId);
          return;
        }
        set({
          lines: get().lines.map((l) => (lineId(l) === lineItemId ? { ...l, quantity } : l)),
        });
      },
      removeItem: (lineItemId) => {
        const remaining = get().lines.filter((l) => lineId(l) !== lineItemId);
        set({ lines: remaining, storeId: remaining.length ? get().storeId : null });
      },
      clear: () => set({ storeId: null, lines: [] }),
      subtotal: () => get().lines.reduce((sum, l) => sum + linePrice(l) * l.quantity, 0),
    }),
    { name: 'otlob-cart' },
  ),
);
