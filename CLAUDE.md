@AGENTS.md

# eWaiter – Project Context

## Čo je tento projekt
eWaiter (Slovak: ecasnik) je SaaS platforma pre reštaurácie a bary.
Zákazník naskenuje QR kód na stole → otvorí sa menu v prehliadači → objedná → zaplatí online.
Žiadna inštalácia, žiadna povinná registrácia.

**Vlastník platformy (Super Admin):** Maros Jurkovic (maros.jurkovic27@gmail.com)

## Tech Stack
- **Framework:** Next.js 16 (App Router, TypeScript)
- **Databáza:** Supabase (PostgreSQL + Auth + Realtime + Storage)
- **Styling:** Tailwind CSS + vlastné CSS premenné (brand farby)
- **UI komponenty:** shadcn/ui (Radix UI)
- **Platby:** Stripe (zatiaľ nenasadené)
- **Ikony:** lucide-react

## Brand farby
- Orange: `#E85B1A` (primárna, CTA tlačidlá)
- Navy: `#1E2D4A` (sidebar, texty)
- Teal: `#2BB58C` (akcenty, success)

## Supabase projekt
- URL: `https://csxvslfuzatwiwmutcld.supabase.co`
- Credentials sú v `.env.local` (nikdy na GitHub!)

## Používateľské roly (v DB enum `user_role`)
| Rola | Popis |
|------|-------|
| `super_admin` | Maros – správca celej platformy |
| `restaurant_admin` | Majiteľ reštaurácie/siete |
| `manager` | Manager konkrétnej prevádzky |
| `waiter` | Čašník |
| `kitchen` | Kuchár |
| `bar` | Barman |
| `customer` | Zákazník (môže byť anonymous) |

**POZOR:** `StaffRole` (venue_staff.role) = `"manager" | "waiter" | "cook" | "barman"` — iné hodnoty než UserRole!
Mapping pri vytváraní staff: cook→kitchen, barman→bar, waiter→waiter, manager→manager

## Štruktúra DB (25+ tabuliek)
**Core:** `profiles`, `organizations`, `venues`, `subscriptions`
**Menu:** `menu_categories`, `menu_items`, `item_variant_groups`, `item_variants`, `item_modifier_groups`, `item_modifiers`, `menu_translations`, `special_offers`
**Prevádzka:** `venue_zones`, `tables`, `venue_staff`, `opening_hours`
**Objednávky:** `table_sessions`, `orders`, `order_items`, `order_item_modifiers`
**Platby:** `payments`, `payment_splits`
**Zákazník:** `reviews`, `item_reviews`, `loyalty_programs`, `loyalty_cards`, `customer_favorites`, `waiter_calls`
**Admin:** `notifications`, `feature_flags`, `audit_logs`, `support_tickets`, `support_messages`

## Routing štruktúra (App Router)
```
/login                    → prihlásenie (všetky roly)
/                         → root redirect podľa role
/sign-out                 → odhlásenie
/super-admin/*            → Super Admin (len Maros)
/admin/*                  → Restaurant Admin / Manager
/staff                    → Čašník app (3 taby: Volania/Stoly/Objednávky)
/staff/kds                → KDS displej (kuchár/barman)
/menu/[token]             → Zákaznícke QR menu (verejné, rozpracované)
```

## Hotové súbory (výber kľúčových)
- `src/lib/supabase/client.ts` – browser klient
- `src/lib/supabase/server.ts` – server klient + admin klient (service role)
- `src/lib/utils.ts` – cn(), formatCurrency(), formatDate()
- `src/types/database.ts` – TypeScript typy (niektoré NESPRÁVNE — pozri db_conventions)
- `src/proxy.ts` – Next.js 16 auth middleware
- `src/app/(auth)/login/page.tsx` – login (onSubmit, nie action={fn}!)
- `src/app/(super-admin)/` – kompletný Super Admin (organizations, users, billing, venues, analytics, support, feature-flags, audit-logs, settings)
- `src/app/(admin)/` – kompletný Restaurant Admin (menu+modifikátory, stoly, staff, objednávky, štatistiky, nastavenia)
- `src/app/(staff)/layout.tsx` – auth cez venue_staff, nie profiles.role
- `src/app/(staff)/StaffHistoryButton.tsx` – história objednávok (7 dní, filtre, otvoriť)
- `src/app/(staff)/staff/` – WaiterClient, KDSClient, actions

## Dôležité konvencie
- `(supabase as any)` pre kolumny mimo TS typov (station, payment_id, closed_at, modifikátory)
- `item_id` NIE `menu_item_id` v order_items!
- `createAdminClient()` (synchronous) pre všetky writes, `await createClient()` pre reads
- Login form: `onSubmit + e.preventDefault()` — NIE `action={fn}` (spôsobí page reload)
- Staff layout auth: kontroluje `venue_staff` existenciu, nie `profiles.role`
- Slovenčina v UI textoch, komentáre len pre WHY

## Plán ďalšieho vývoja (poradie)
1. ✅ Super Admin dashboard + všetky sekcie
2. ✅ Restaurant Admin – menu, stoly, staff, objednávky, štatistiky
3. ✅ Čašník app (WaiterClient) + KDS
4. ✅ Modifikátory (McDonald's štýl, admin UI + waiter picker)
5. ✅ Platby (split, void, história)
6. ⬜ **QR menu pre zákazníkov** (`/menu/[token]`) — NEXT PRIORITY
7. ⬜ Stripe integrácia
8. ⬜ Opening hours UI
9. ⬜ QR kód generovanie/tlač v tables
10. ⬜ Zákaznícka registrácia + loyalty
