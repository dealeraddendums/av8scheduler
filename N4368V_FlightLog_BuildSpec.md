# N4368V Flight Log — Full Build Specification
**1984 Piper Archer II · Allan Tone + Chip**
*Version 1.1 — May 2026*

---

## Completed Status

| Phase | Status | Notes |
|-------|--------|-------|
| Figma deps removed | ✅ Done | vite.config.ts + Home.tsx + Settings.tsx cleaned |
| Supabase migration SQL | ✅ Done | supabase/migrations/001_flight_log.sql |
| API routes | ✅ Done | All routes deployed as `make-server-82b8c834` (entrypoint `supabase/functions/make-server-82b8c834/index.ts`); verified 2026-05-26 |
| nginx config | ✅ Done | deploy/nginx-n4368v.conf |
| GitHub Actions | ✅ Done | .github/workflows/deploy.yml |
| EC2 provisioned | ✅ Done | t3.micro us-west-1, Ubuntu 24.04 |
| nginx installed + configured | ✅ Done | sites-enabled, default removed |
| dist/ deployed | ✅ Done | rsync to /var/www/n4368v |
| DNS propagated | ✅ Done | All 6 resolvers → 13.56.240.152 |
| SSL / certbot | ✅ Done | Let's Encrypt cert issued 2026-05-26, expires 2026-08-24, auto-renew scheduled; HTTP→HTTPS redirect active |
| GitHub secrets | ✅ Done | EC2_IP + SSH_PRIVATE_KEY set on dealeraddendums/av8scheduler |
| Supabase SQL run | ✅ Done | 001_flight_log.sql executed in dashboard (2026-05-26) |
| Supabase storage bucket | ✅ Done | flight-photos (private) created 2026-05-26 |
| Supabase ANTHROPIC_API_KEY | ✅ Done | Added to Edge Function secrets 2026-05-26 |

---

## Infrastructure

- **EC2:** t3.micro, us-west-1, Ubuntu 24.04
- **IP:** 13.56.240.152 (Elastic IP)
- **SSH:** `ssh -i ~/ssh/n4368v2026.pem ubuntu@ec2-13-56-240-152.us-west-1.compute.amazonaws.com`
- **Web root:** `/var/www/n4368v`
- **Domain:** n4368v.com → 13.56.240.152
- **Supabase project:** `gigaittsnznvzppfqqer`
- **Local project:** `/Users/allantone/Sites/Aircraft-Scheduler-Log`

---

## To complete SSL (first thing after reboot)

1. AWS Console → EC2 → Security Groups → n4368v instance → Edit inbound rules
2. Add rule: HTTP / port 80 / source 0.0.0.0/0 → Save
3. Then run:
```bash
ssh -i ~/ssh/n4368v2026.pem ubuntu@ec2-13-56-240-152.us-west-1.compute.amazonaws.com \
  "sudo certbot --nginx -d n4368v.com -d www.n4368v.com \
  --non-interactive --agree-tos -m allan@allantone.com --redirect"
```

---

## 1. Project Overview

Add a Flight Log module to the existing N4368V aircraft scheduler (n4368v.com), migrated off Figma hosting to a self-hosted EC2 instance. Pilots log flights by selecting destination, photographing the instrument panel, and confirming AI-read gauge values. Allan (allan@allantone) has full admin access. A companion iOS app (React Native / Expo) ships to TestFlight for the same two pilots. Architecture is designed to scale to a multi-aircraft SaaS later.

---

## 2. Migration: Figma → EC2

### ✅ Completed
- Figma deps removed from vite.config.ts, Home.tsx, Settings.tsx
- EC2 t3.micro provisioned at 13.56.240.152
- nginx installed and configured
- deploy/nginx-n4368v.conf in repo
- .github/workflows/deploy.yml in repo
- dist/ live at /var/www/n4368v
- DNS propagated

### Remaining
- Open port 80 in security group → run certbot → SSL live
- Add GitHub secrets: EC2_IP + SSH_PRIVATE_KEY

---

## 3. Design System (Match Existing Scheduler)

The flight log must be visually identical to the scheduler. Use these exact values everywhere.

```css
/* Pilot colors */
--color-navy:      #4E5166;   /* primary / Allan */
--color-blue-gray: #7C90A0;   /* secondary / Chip */
--color-tan:       #B5AA9D;   /* muted */
--color-sage:      #B9B7A7;   /* accent */
--color-charcoal:  #747274;   /* neutral */

/* Borders, backgrounds */
--border: rgba(78, 81, 102, 0.2);
--sidebar: #f8f8f8;
--radius: 0.625rem;
```

Pilot color assignment (deterministic, by user ID):
- Allan → `#4E5166` (navy)
- Chip → `#7C90A0` (blue-gray)
- Future pilots → `#B5AA9D`, `#747274`, `#B9B7A7` in order

---

## 4. Supabase Schema Changes

### ✅ Migration file created: supabase/migrations/001_flight_log.sql
Still needs to be run in Supabase dashboard for project `gigaittsnznvzppfqqer`.

```sql
-- Destinations lookup
CREATE TABLE destinations (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  icao        text NOT NULL UNIQUE,
  name        text NOT NULL,
  is_favorite boolean DEFAULT true,
  sort_order  int DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

INSERT INTO destinations (icao, name, sort_order) VALUES
  ('KORS', 'Orcas Island',       1),
  ('KBLI', 'Bellingham Intl',    2),
  ('KFHR', 'Friday Harbor',      3),
  ('KBVS', 'Skagit Regional',    4),
  ('KBFI', 'Boeing Field',       5),
  ('KPAE', 'Paine Field',        6),
  ('KRNT', 'Renton Muni',        7),
  ('KOLM', 'Olympia Regional',   8);

CREATE TABLE flights (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pilot_id    text NOT NULL,
  pilot_name  text NOT NULL,
  date        date NOT NULL,
  destination text NOT NULL,
  hobbs_end   numeric(6,1) NOT NULL,
  tach_end    numeric(6,1) NOT NULL,
  hobbs_used  numeric(4,1),
  tach_used   numeric(4,1),
  notes       text,
  photo_url   text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_flights_date ON flights(date DESC);
CREATE INDEX idx_flights_pilot ON flights(pilot_id);

ALTER TABLE flights ENABLE ROW LEVEL SECURITY;
ALTER TABLE destinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_flights" ON flights FOR ALL USING (true);
CREATE POLICY "allow_all_destinations" ON destinations FOR ALL USING (true);
```

### Supabase Storage bucket
```
Bucket name: flight-photos
Public: false
File path: {pilot_id}/{date}/{uuid}.jpg
```

---

## 5. New API Routes (Edge Function)

### ✅ All routes implemented in supabase/functions/server/index.tsx

Routes added:
- GET/POST/DELETE /destinations
- GET /flights (pilot_id, limit, offset params)
- GET /flights/totals (by_pilot + oil alert)
- GET /flights/last-reading
- POST /flights (auto-computes hobbs_used + tach_used)
- DELETE /flights/:id
- POST /read-gauges (Claude vision → {hobbs, tach, confidence})
- GET /flights/export?format=csv

AI gauge-reading prompt:
```
You are reading aircraft instrument gauges from a cockpit photo.
Find the Hobbs meter (elapsed time, shows decimal hours like 456.3)
and the Tach meter (RPM/hours display showing engine time like 61.0).
Return ONLY valid JSON: {"hobbs": 96.8, "tach": 63.1, "confidence": "high"}
If you cannot read a value clearly, use null and set confidence to "low".
```

---

## 6. Web App — Flight Log Tab

### ⏳ Phase 2 — not yet started

Location in component tree:
```
src/app/views/Home.tsx
  <Tabs>
    <TabsList>
      <TabsTrigger value="calendar">  ← existing
      <TabsTrigger value="list">      ← existing
      <TabsTrigger value="log">       ← NEW
    </TabsList>
    <TabsContent value="log">
      <FlightLog />
    </TabsContent>
```

New files to create:
```
src/app/components/FlightLog/
  index.tsx              — tab container, data fetching, state
  FlightList.tsx         — chronological list with pilot filter
  AddFlightDialog.tsx    — 4-step wizard
  GaugeCapture.tsx       — camera/upload + AI reading + manual override
  FlightTotals.tsx       — summary stats bar (Hobbs, Tach, oil alert)
  AdminPanel.tsx         — destinations CRUD + export (Allan only)
  useFlights.ts          — data hook
  useDestinations.ts     — destinations hook
```

AddFlightDialog steps:
1. Pilot (auto from logged-in) + Date (today default) + Destination grid
2. Gauge photo → `<input type="file" accept="image/*" capture="environment">` → POST /read-gauges → show AI result + override
3. Review: pilot, date, dest, ending Hobbs/Tach, computed delta
4. Confirm → POST /flights → Sonner toast → dialog close → list refresh

Admin detection:
```typescript
const isAdmin = loggedInUser?.email === 'allan@allantone' || loggedInUser?.id === 'user1'
```

---

## 7. iOS App (React Native / Expo)

### ⏳ Phase 3 — not yet started

Monorepo structure:
```
n4368v/
  packages/
    api/    — shared hooks: useFlights, useDestinations, useGaugeRead
    ui/     — shared components: FlightListItem, etc.
  apps/
    web/    — existing Vite app
    ios/    — Expo app
```

iOS screens: Log (default) → Add Flight (bottom sheet, 4 steps) → Settings (+ Admin tab for Allan)

Key native patterns:
- Camera: expo-camera → JPEG → base64 → POST /read-gauges
- Offline queue: AsyncStorage → retry on AppState foreground
- Auth: expo-secure-store for PIN session (replaces cookie)

app.json bundle ID: `com.allantone.n4368v`

TestFlight: `eas build --platform ios --profile preview` → `eas submit`

---

## 8. Oil Change Alert

Oil due sticker in photo: **Tach 643**
Stored in KV: `kv.set('maintenance:oil_due_tach', 643)`
Admin-updatable after each oil change — no code deploy needed.

Alert levels:
- < 10 hrs remaining → danger (red)
- < 25 hrs remaining → warning (amber)
- ≥ 25 hrs remaining → ok

---

## 9. Export Formats

CSV (full log): date, pilot, destination, hobbs_end, tach_end, hobbs_used, tach_used, notes
PDF (pilot summary): generated client-side with jsPDF — per-pilot totals + combined + oil status

---

## 10. Future SaaS Path

Schema additions when going multi-aircraft:
```sql
CREATE TABLE aircraft (
  id            uuid PRIMARY KEY,
  tail_number   text UNIQUE,
  make_model    text,
  owner_user_id text,
  oil_due_tach  numeric(6,1)
);
-- Add aircraft_id FK to flights and destinations
```
Auth upgrade: Supabase Auth (email/magic link) replacing PIN system.
Billing: integrate with existing da-billing at billing.dealeraddendums.com.

---

## 11. Build Order

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 1a | Figma migration (strip deps, build clean) | ✅ Done |
| 1b | Supabase schema + API routes | ✅ Done |
| 1c | EC2 + nginx + DNS + SSL | ✅ Done |
| 1d | GitHub Actions live deploy | ✅ Done (dealeraddendums/av8scheduler, ~25s push-to-live, verified 2026-05-26) |
| 2 | Web: FlightLog tab + all components | ⏳ Not started |
| 3 | iOS: Expo monorepo + all screens | ⏳ Not started |
| 4 | TestFlight build + distribution | ⏳ Not started |

---

## 12. Environment Variables

```bash
# Supabase Edge Function secrets (set in dashboard):
ANTHROPIC_API_KEY=sk-ant-...

# Already present in Edge Function env:
SUPABASE_URL=https://gigaittsnznvzppfqqer.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...

# GitHub Actions secrets:
EC2_IP=13.56.240.152
SSH_PRIVATE_KEY=[contents of ~/ssh/n4368v2026.pem]

# Expo (apps/ios/.env — Phase 3):
EXPO_PUBLIC_SUPABASE_URL=https://gigaittsnznvzppfqqer.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
EXPO_PUBLIC_API_BASE=https://gigaittsnznvzppfqqer.supabase.co/functions/v1/make-server-82b8c834
```

---

## 13. Key Decisions Locked

- ✅ Flight log as new tab in existing n4368v.com (not separate app)
- ✅ Same Supabase project gigaittsnznvzppfqqer — SQL tables alongside KV store
- ✅ Admin = allan@allantone / user1
- ✅ Destinations: KORS KBLI KFHR KBVS KBFI KPAE KRNT KOLM (seeded); admin can add/remove
- ✅ iOS via Expo → TestFlight (internal); App Store later
- ✅ Monorepo (shared API hooks + UI between web and iOS)
- ✅ Oil due alert: Tach 643, KV-stored, admin-updatable
- ✅ AI gauge reading via claude-sonnet-4-20250514 vision from Edge Function
- ✅ Design: exact match to scheduler palette (#4E5166, #7C90A0, #B5AA9D, #B9B7A7)
- ✅ EC2: t3.micro us-west-1 13.56.240.152, SSH key ~/ssh/n4368v2026.pem
