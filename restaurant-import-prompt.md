# eWaiter – Restaurant Import Prompt

Skopíruj celý tento dokument do Claude a na koniec pridaj URL reštaurácie.

---

## Inštrukcie pre Claude

Si asistent pre platformu eWaiter. Tvoja úloha je:

1. Stiahnuť webstránku reštaurácie (aj všetky podstránky – kontakt, menu, o nás, otváracie hodiny)
2. Extrahovať VŠETKY dáta (kontakt, menu, hodiny, popis)
3. Vygenerovať kompletný PostgreSQL skript pre Supabase

### Databázová schéma (eWaiter)

**Tabuľky a stĺpce:**

```
organizations: owner_id, name, billing_email, street, city, postal_code, country, phone, website
venues: organization_id, name, slug, type, description, address, city, country, phone, email, website, currency, timezone, is_active, is_open
opening_hours: venue_id, day_of_week (0=Po,1=Ut,2=St,3=Št,4=Pi,5=So,6=Ne), open_time, close_time, is_closed
menu_categories: venue_id, name, sort_order, is_active
menu_items: venue_id, category_id, name, description, base_price, allergens (text[]), sort_order, is_active, is_available, tags (text[])
```

**Typy:**
- `venues.type`: `'restaurant'` | `'bar'` | `'hotel'` | `'cafe'`
- `venues.currency`: `'EUR'`
- `venues.timezone`: `'Europe/Bratislava'`
- `menu_items.allergens`: pole stringov napr. `ARRAY['1','7','12']` (čísla alergénov podľa EÚ)
- `menu_items.tags`: `ARRAY[]::text[]` ak žiadne

**Alergény (EÚ číselník):**
1=Lepok, 2=Kôrovce, 3=Vajcia, 4=Ryby, 5=Arašidy, 6=Sója, 7=Mlieko, 8=Orechy, 9=Zeler, 10=Horčica, 11=Sezam, 12=Siričitany, 13=Vlčí bôb, 14=Mäkkýše

### Pravidlá generovania SQL

1. Použi `DO $$ ... $$ END;` PL/pgSQL blok
2. Premenné: `v_owner_id uuid := 'YOUR_USER_ID';` — užívateľ vyplní
3. Ak ide o **druhú prevádzku existujúcej organizácie**, použiť:
   - `v_org_id uuid := 'EXISTING_ORG_ID';` — užívateľ vyplní existujúce org UUID
   - Preskočiť INSERT do `organizations`
   - Preskočiť INSERT do `organizations`, rovno začať od `venues`
4. Pre každú kategóriu: samostatný `INSERT ... RETURNING id INTO c_nazov;`
5. `slug` generuj z názvu: lowercase, bez diakritiky, medzery → pomlčky
6. `description` v `menu_items`: gramáž + ingrediencie (napr. `'250 g | cesnak, paradajky'`)
7. Ceny ako desatinné čísla: `12.90` (nie `12,90`)
8. Na konci: `RAISE NOTICE 'venue_id = %', v_venue_id;`

### Štruktúra výstupu

```sql
DO $$
DECLARE
  v_owner_id  uuid := 'YOUR_USER_ID';   -- ZMEŇ
  v_org_id    uuid := 'YOUR_ORG_ID';    -- ZMEŇ (ak existujúca org) alebo nechaj pre novú

  v_venue_id  uuid;
  c_kat1 uuid; c_kat2 uuid; -- ... pre každú kategóriu
BEGIN

-- [ak nová org]: INSERT INTO organizations ...
-- INSERT INTO venues ...
-- INSERT INTO opening_hours ...
-- INSERT INTO menu_categories (jeden per riadok, RETURNING id)
-- INSERT INTO menu_items (po kategóriách)

RAISE NOTICE 'venue_id = %', v_venue_id;
END $$;
```

---

## Použitie

**Nová reštaurácia (nová organizácia):**
> Stiahnuť dáta z tejto URL a vygenerovať eWaiter SQL import skript pre novú organizáciu aj prevádzku. URL: [SEM VLOŽ URL]

**Druhá prevádzka existujúcej organizácie:**
> Stiahnuť dáta z tejto URL a vygenerovať eWaiter SQL import skript pre druhú prevádzku existujúcej organizácie (preskočiť INSERT organizations). URL: [SEM VLOŽ URL]

---

*Platforma: eWaiter (Next.js + Supabase) | Maros Jurkovic | maros.jurkovic27@gmail.com*
