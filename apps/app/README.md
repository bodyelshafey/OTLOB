# OTLOB (أطلب) — Mobile App

React Native + Expo (TypeScript) client for the OTLOB marketplace. This is a
**pure client** — all auth, business logic, and data live in the existing
NestJS API. Nothing here touches Supabase or the database directly.

## What was actually broken, and what I fixed

The first pass was built strictly from the API reference in the original
prompt, which didn't match the real backend in several places. You sent over
the working Next.js web app's source, which is ground truth for the real
response shapes — I diffed against it and fixed every mismatch:

- **`/stores` and `/products` return `{ items: [...] }`**, not a bare array.
  Every list screen was reading the response as an array directly and would
  have rendered nothing. `lib/endpoints/catalog.ts` now unwraps `.items`.
- **Field names were wrong throughout**: `image` not `imageUrl`, `coverImage`
  not `coverImageUrl`, `avatar` not `avatarUrl`, `orderStatus` not `status`,
  `nameAr`/`nameEn` not `name` for store types and categories. Every type in
  `lib/types.ts` and every screen that reads these fields is corrected.
- **A real crash bug**: the 401-refresh interceptor in `lib/api.ts` was
  calling `setTokens({ accessToken, refreshToken })` but the auth store's
  `setTokens` takes two positional arguments, not an object. This would have
  thrown the moment any access token expired mid-session — logging every
  user out unpredictably. Fixed.
- **Cart/checkout didn't match how the backend actually works**: the cart is
  local-only until checkout, at which point the real flow is `DELETE /cart`
  → `POST /cart` once per line → `POST /orders`. `lib/endpoints/orders.ts`
  now does exactly that (`syncCartAndPlaceOrder`), and `store/cartStore.ts`
  holds full `Product` objects the same way the web app's cart store does.
- **Addresses**: real create payload is `{ districtId, fullAddress }` — no
  `zoneId`, no separate `label`/`details` fields. Fixed in `addresses.tsx`
  and the checkout screen.
- **Password minimum is 8 characters**, not 6 — fixed in the register
  screen's client-side validation.
- **A handful of RN style properties** (`insetInlineStart`/`insetInlineEnd`)
  aren't in this RN version's stable types — swapped for the equivalent
  `start`/`end` logical properties, which are stable and still RTL-aware.

I ran `npx tsc --noEmit` against your installed `node_modules` after all of
this — it now passes clean with zero type errors. That doesn't guarantee
runtime correctness against the live API (I still don't have network access
in this sandbox), but it does mean the code is internally consistent with
the real types now, instead of the guessed ones.

## What's in this pass

The **full customer flow**, end to end:

- Onboarding → Login / Register (JWT auth, access+refresh, auto-retry-on-401)
- Home (search entry, store-type chips, offers carousel, nearby stores)
- Store list (search + type filter, 2-column grid)
- Store details (category tabs, product list, add-to-cart)
- Cart (single-store enforced — adding from a second store prompts to clear)
- Checkout (saved address or manual entry, cash/card, place order)
- Order tracking (live status over Socket.IO, driver map once `DELIVERING`)
- Order history
- Addresses (list/add/delete via district picker)
- Favorites (stores & products, tabbed)
- Notifications (in-app, socket-driven)
- Profile (view/edit, avatar upload via `expo-image-picker` + `/upload/image`,
  Arabic/English toggle, logout, and a role-based link into a dashboard)

Also in place: Arabic-first RTL layout with an English toggle, the Cairo /
Tajawal / IBM Plex Mono type system, the `#12bfe5` brand palette, pill
buttons, rounded cards, and the full `lib/`, `store/`, `hooks/`, `i18n/`
infrastructure the rest of the app (including the dashboards below) will
reuse.

## What's stubbed, on purpose

`app/dashboard/store.tsx`, `driver.tsx`, and `admin.tsx` are placeholder
screens so role-based navigation from Profile doesn't dead-end. The actual
dashboards (product/offer/category CRUD, live order management for store
owners; available-orders/accept/earnings for drivers; platform stats, store
directory, and coupon management for admins) are the next build pass — say
the word and I'll do store owner, driver, or admin first, whichever you need
soonest.

## Setup

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go, or press `i` / `a` for a simulator/emulator.
No `.env` needed for local dev — the API base URL and socket URL are read
from `app.json`'s `expo.extra` block. If you ever need to point at a
different backend (e.g. a staging environment), edit those two values there.

### Fonts
`app/_layout.tsx` loads Cairo, Tajawal, and IBM Plex Mono via
`@expo-google-fonts/*` packages (already in `package.json` — `npm install`
pulls them automatically, no manual font files needed).

### Maps
`react-native-maps` needs a native build to render (it won't work in Expo
Go on iOS without a dev client, and Android Expo Go needs Google Play
services). For quick iteration: `npx expo run:ios` / `npx expo run:android`,
or `eas build --profile development`.

### App icons/splash
`assets/icon.png`, `adaptive-icon.png`, and `splash.png` are solid
`#12bfe5` placeholders right now — swap them for the real "أ" mark whenever
you have the final artwork exported at 1024×1024 (icon) and a portrait size
for splash.

## Things still worth flagging

- **Push notifications**: still no device-token registration endpoint in
  what I've seen, so `hooks/useNotificationSocket.ts` still wires up in-app
  delivery over the `notification:new` socket event only. Real push needs a
  backend endpoint first.
- **Favorites shape is now confirmed** (not assumed) from your web app's
  `profile/favorites/page.tsx` — each record embeds `{ store }` or
  `{ product }`, which is what `app/(tabs)/favorites.tsx` reads.
- **Still not smoke-tested against the live API** — I don't have network
  access in this sandbox. Everything now matches your web app's source
  exactly, which is a much stronger guarantee than the original spec-only
  build, but please still run `npx expo start` and click through login →
  home → store → cart → checkout → order tracking as your first real test.
- I only had the web app's *customer-facing* pages to cross-check against
  (home, stores, checkout, profile, addresses, favorites, orders). The
  `web/src/app/dashboard/*` pages in your zip are there too, and I used
  `web/src/lib/dashboard-nav.ts` to confirm the dashboard tab structure, but
  I haven't rebuilt `app/dashboard/*` against them yet — see Next steps.

## Folder structure

```
app/            Expo Router routes (file-based)
  (auth)/       onboarding, login, register
  (tabs)/       home, stores, orders, favorites, profile
  store/[id]    store details
  order/[id]    order tracking
  dashboard/    role dashboards (placeholders — next pass)
  profile/      edit profile, language toggle
components/     shared UI (Button, cards, form fields, badges)
lib/            api client, socket client, endpoint modules, shared types
  endpoints/    one file per API domain (auth, catalog, orders, engagement, driver, management)
store/          zustand: auth, cart, settings (locale)
hooks/          react-query hooks + small utility hooks
i18n/           ar.json / en.json + i18n-js setup
theme/          colors, fonts, spacing, radii tokens
```

## Next steps

1. `npm install && npx expo start` and click through the customer flow
   end to end against your live API — tell me exactly what breaks, if
   anything, and I'll fix it immediately rather than guess again.
2. Tell me which dashboard to build next — store owner, driver, or admin.
   I now have your real `web/src/app/dashboard/*` pages, `DashboardShell.tsx`,
   `RoleGate.tsx`, `StatCard.tsx`, and `dashboard-nav.ts` to build the mobile
   versions against exactly instead of guessing, the same way I just fixed
   the customer flow.
3. Once you've got real brand assets, swap the placeholder icon/splash PNGs.
