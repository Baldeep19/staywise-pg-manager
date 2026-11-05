# Staywise PG Manager

Owner-first PG operations app. The repository contains the responsive app prototype in `public/`, and a Supabase/Postgres backend schema in `supabase/migrations/`.

See [docs/APP_DESIGN.md](docs/APP_DESIGN.md) for the product design, workflows, electricity calculation rules, data model, technology stack, deployment flow, and roadmap.

## Backend data model

- Properties owned by an authenticated user
- Flats belonging to a property
- Residents assigned to flats
- Rent payments
- Individual electricity bill entries with flat, resident, amount and due date

Row-level security policies restrict data access to the signed-in property owner.

## Run locally

1. Install Node.js 20+.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and add the Supabase project URL and publishable key.
4. Run `npm run dev`.

Owner email/password sign-in and resident reads/writes are connected to Supabase. Rent payments and electricity bills still use browser storage and are not yet synced to the backend.

## Set up the backend

1. Create a Supabase project in South Asia (Mumbai / `ap-south-1`).
2. Apply `supabase/migrations/202611020001_initial_schema.sql` using Supabase CLI or SQL Editor.
3. Configure email sign-in and owner accounts. Keep service-role secrets server-side; only the publishable key belongs in a browser app.
4. Configure backups, MFA for the owner account, and private storage buckets if adding documents.

## Deploy

Connect this Git repository to a commercial hosting provider such as Vercel, set the root to this folder, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, and deploy. Vite's build command is `npm run build`, output directory `dist`.

Before deployment with real resident data, complete authentication/database integration in the UI and configure production RLS and backups. Automated WhatsApp delivery also needs a WhatsApp Business Platform account and backend integration.

## Owner sign-in setup

Email/password sign-up requires email confirmation unless confirmation is disabled in Supabase Auth settings. After signing up, check the inbox for the confirmation link and then sign in.

## Building setup

First owner sign-in routes to property setup. The owner enters property name/address and adds each flat or room with floor and bed count. Flats are saved in Supabase; resident assignment and electricity bill selection use these saved flat names. Apply `supabase/migrations/202611020003_property_setup.sql` before launching this setup flow. Existing flats with active residents cannot be removed in setup until those residents are moved.

Flat setup records the **number of rooms** per flat, not the number of beds. Apply migration `202611020004_room_count.sql` after `202611020003_property_setup.sql` to rename the database field while preserving existing values.

Flat setup also has optional per-flat Wi-Fi network and password fields, editable later from Settings → Edit building details. Apply `supabase/migrations/202611020005_flat_wifi.sql` first. These fields are owner-only under the existing flat RLS policy; do not share them in resident messages.

If property setup reports an owner foreign-key error, apply migration `202611020006_property_owner_default.sql`. Property creation now omits a client-supplied owner ID; Postgres assigns `auth.uid()` from the signed-in Supabase request.

Resident entry captures single/double sharing and optional deposit amount. Residents can be archived from the Residents list; their transaction history is retained. Apply migration `202611020007_resident_sharing_deposit.sql` before using these fields.

Electricity bills and their payments are stored in Supabase. The owner can record full or partial payments against each bill; status updates to Paid once payments cover the amount. Apply `supabase/migrations/202611020008_electricity_payments.sql` before using the payment action.

The owner app refreshes resident, rent, flat, and electricity records through Supabase Realtime. Apply `supabase/migrations/202611020009_enable_realtime.sql` to add these tables to the `supabase_realtime` publication.

Rent payments are stored as one monthly record per resident. Apply `supabase/migrations/202611020010_single_monthly_rent_record.sql` before deploying this version. It removes exact duplicate submissions, combines distinct partial payments for the same month, keeps the latest payment date, and adds an atomic monthly payment upsert.

Electricity meter readings are stored per flat and bill cycle. Apply `supabase/migrations/202611020011_electricity_meter_history.sql` to create the protected history table and enable realtime updates. The form carries forward each flat’s latest saved current readings as the next cycle’s previous readings; the Reports page shows both meters’ previous/current readings and units consumed.

Electricity split inputs add the flat main bill and building common meter total to the cycle history. The main flat amount is allocated by Room 1 · Left meter and Room 2 · Right meter unit consumption, then split between residents mapped to each meter. Common charges are divided by the active flat count and then equally among selected residents in that flat. Resident meter-side assignments persist between cycles. Apply `supabase/migrations/202611020012_electricity_bill_split.sql` before deploying this update.
