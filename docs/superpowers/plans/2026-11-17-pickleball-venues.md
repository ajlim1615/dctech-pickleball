# Pickleball Venues (Courts Directory & Google Maps Links) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `venues` table in Supabase pre-seeded with the 4 pickleball venues and their Google Maps links, link `sessions.venue_id` to `venues.id`, allow Admins to add/edit/archive venues and search/pick them when creating or editing a session, and render clickable Google Maps links on session locations for players.

**Architecture:** Store pickleball venues in `public.venues` (`id`, `name`, `maps_url`, `address`, `notes`, `is_active`, `created_at`, `updated_at`) separate from `public.courts` (which represents live in-session Court 1–4 match slots). Add `sessions.venue_id uuid references public.venues(id) on delete set null` (indexed) while keeping `sessions.location` for display and custom-location fallback. Resolve `maps_url` by `venue_id` first, then fall back to case-insensitive trimmed `location` matching.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, TypeScript, Tailwind CSS, Supabase (PostgreSQL + RLS), Zod, Vitest.

## Global Constraints

- Only Admins (`requireAdminUser()` / `public.is_admin()`) may insert, update, or archive/delete rows in `public.venues`; all authenticated users may `SELECT`.
- `maps_url` must be validated on both client and server to only allow `https://` or `http://` URLs (max 500 chars), rejecting `javascript:`, `data:`, and non-URL strings.
- Existing `sessions.location` values and Excel exports must continue working without requiring a destructive migration on `sessions`.
- All new/modified TypeScript code must pass `npx tsc --noEmit` and `npm test` (`vitest run`).

## Review Focus

- **Invalid or unsafe `maps_url`:** An admin pastes a `javascript:` URI or plain text instead of a URL — `isValidMapsUrl` and `createVenue`/`updateVenue` must reject it with a clear error.
- **Duplicate venue names:** Adding or renaming a venue to match an existing name (case-insensitive) should fail gracefully with a friendly message rather than throwing an unhandled DB error.
- **Custom session location not in `venues`:** An admin types a one-off location that isn't in `venues` — `VenuePicker` must clear `venueId` and submit the custom `location` text, and `VenueLocationLink` must render plain text without a broken link.
- **Renamed venue resilience:** Renaming a venue in Admin must keep Google Maps links working on existing sessions linked via `venue_id`, and fall back to case-insensitive `location` matching for legacy sessions.
- **Non-admin access:** A player calling `createVenue`, `updateVenue`, or `setVenueActive` directly must be blocked by `requireAdminUser()` and Supabase RLS.

---

### Task 1: Database Migration & TypeScript Types

**Files:**
- Create: `supabase/migrations/20261117070000_pickleball_venues.sql`
- Modify: `src/types/database.types.ts`
- Modify: `src/types/index.ts`

**Interfaces:**
- Produces: `Database["public"]["Tables"]["venues"]`, `sessions.venue_id`, and `Venue` type exported from `@/types`.

- [ ] **Step 1: Create `supabase/migrations/20261117070000_pickleball_venues.sql`**

Create `public.venues` (`id uuid primary key default gen_random_uuid()`, `name text not null`, `maps_url text not null`, `address text`, `notes text`, `is_active boolean not null default true`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`), add unique index `venues_name_lower_idx` on `lower(trim(name))`, add `venue_id uuid references public.venues(id) on delete set null` and index `sessions_venue_id_idx` on `public.sessions`, enable RLS on `public.venues` (`SELECT` for `authenticated`, `INSERT`/`UPDATE`/`DELETE` for `(select public.is_admin())`), and seed the 4 venues:
- `The Forge Pickleball Court` — `https://maps.app.goo.gl/Ry6qjodsQBR6DavL8`
- `Balhai CrossCourt` — `https://maps.app.goo.gl/3ZoKoykpLfCtyThw5`
- `Flying pickle sports center` — `https://maps.app.goo.gl/9x3G1UHfAWTGCJ3T8`
- `Paddle Republic Sports Center` — `https://maps.app.goo.gl/pKx4GvHQK2d7hCoa9`

- [ ] **Step 2: Update `src/types/database.types.ts` and `src/types/index.ts`**

Add `venues` table definition and `venue_id: string | null` on `sessions` in `src/types/database.types.ts`; export `Venue` from `src/types/index.ts`.

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: Exit code 0.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261117070000_pickleball_venues.sql src/types/database.types.ts src/types/index.ts
git commit -m "feat: add venues table migration and session venue_id FK"
```

---

### Task 2: Venue Validation & Lookup Helpers (TDD)

**Files:**
- Create: `src/features/venues/utils/venueUtils.ts`
- Test: `src/features/venues/utils/venueUtils.test.ts`

**Interfaces:**
- Produces:
  - `isValidMapsUrl(raw: string): boolean`
  - `filterVenues<T extends { name: string; is_active?: boolean }>(venues: T[], query: string, activeOnly?: boolean): T[]`
  - `findVenueForSession(session: { venue_id?: string | null; location?: string | null }, venues: { id: string; name: string; maps_url: string }[]): { id: string; name: string; maps_url: string } | null`

- [ ] **Step 1: Write failing tests in `src/features/venues/utils/venueUtils.test.ts`**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement `venueUtils.ts`**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

---

### Task 3: Venue Server Actions & Session `venue_id` Persistence

**Files:**
- Create: `src/features/venues/api/venueActions.ts`
- Modify: `src/features/sessions/api/sessionActions.ts`
- Modify: `src/features/admin/api/adminActions.ts`

**Interfaces:**
- Consumes: `requireAdminUser`, `sanitizeString`, `isValidMapsUrl`, `Venue`.
- Produces:
  - `getVenues(): Promise<Venue[]>` (wrapped in React `cache`)
  - `createVenue(params: { name: string; mapsUrl: string; address?: string; notes?: string }): Promise<{ success?: boolean; venue?: Venue; error?: string }>`
  - `updateVenue(venueId: string, params: { name: string; mapsUrl: string; address?: string; notes?: string }): Promise<{ success?: boolean; venue?: Venue; error?: string }>`
  - `setVenueActive(venueId: string, isActive: boolean): Promise<{ success?: boolean; error?: string }>`

- [ ] **Step 1: Implement `src/features/venues/api/venueActions.ts`**
- [ ] **Step 2: Persist `venue_id` in `createSession` (`sessionActions.ts`) and `editSession` (`adminActions.ts`) when `venueId` is submitted in `FormData`**
- [ ] **Step 3: Run typecheck**
- [ ] **Step 4: Commit**

---

### Task 4: Admin Venues Manager & Searchable Venue Picker in Session Forms

**Files:**
- Create: `src/features/venues/components/AdminVenuesSection.tsx`
- Create: `src/features/venues/components/VenuePicker.tsx`
- Modify: `src/features/admin/components/AdminDashboard.tsx`
- Modify: `src/app/(app)/admin/page.tsx`
- Modify: `src/features/sessions/components/SessionList.tsx`
- Modify: `src/app/(app)/sessions/page.tsx`

**Interfaces:**
- Produces:
  - `AdminVenuesSection({ initialVenues }: { initialVenues: Venue[] })` (add, inline edit, archive/restore venues)
  - `VenuePicker({ venues, name, venueIdName, defaultValue, defaultVenueId, placeholder })` (searchable picker emitting both `location` and `venueId`, supporting custom text)

- [ ] **Step 1: Create `VenuePicker.tsx` and `AdminVenuesSection.tsx`**
- [ ] **Step 2: Wire `venues` into `AdminPage`, `AdminDashboard`, `SessionsPage`, and `SessionList`**
- [ ] **Step 3: Run typecheck & tests**
- [ ] **Step 4: Commit**

---

### Task 5: Clickable Google Maps Location Links for Players

**Files:**
- Create: `src/features/venues/components/VenueLocationLink.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/(app)/sessions/[id]/page.tsx`
- Modify: `src/features/sessions/components/SessionDetailView.tsx`
- Modify: `src/features/sessions/components/SessionRow.tsx`
- Modify: `src/features/sessions/components/SessionList.tsx`

**Interfaces:**
- Consumes: `findVenueForSession` from `@/features/venues/utils/venueUtils`.
- Produces: `VenueLocationLink({ location, venueId, venues, className })` — renders an external `<a>` (`target="_blank" rel="noopener noreferrer"`) with an external-link icon when a matching venue `maps_url` exists, or plain `<span>` otherwise.

- [ ] **Step 1: Create `VenueLocationLink.tsx`**
- [ ] **Step 2: Wire `getVenues()` and `VenueLocationLink` into Home (`page.tsx`), Sessions list (`SessionList.tsx` / `SessionRow.tsx`), and Session detail (`sessions/[id]/page.tsx` / `SessionDetailView.tsx`)**
- [ ] **Step 3: Run full verification (`npx tsc --noEmit` and `npm test`)**
- [ ] **Step 4: Commit**
