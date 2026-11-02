# Staywise PG Manager

Owner-first PG operations app. The repository contains the responsive app prototype in `public/`, and a Supabase/Postgres backend schema in `supabase/migrations/`.

## Backend data model

- Properties owned by an authenticated user
- Flats belonging to a property
- Residents assigned to flats
- Rent payments
- Individual electricity bill entries with flat, resident, amount and due date

Row-level security policies restrict data access to the signed-in property owner. No Aadhaar field is in the normal schema. Do not add real Aadhaar values to this app until a separately secured and legally reviewed vault workflow is in place.

## Run locally

1. Install Node.js 20+.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and add the Supabase project URL and publishable key.
4. Run `npm run dev`.

Owner email/password sign-in and resident reads/writes are connected to Supabase. Rent payments and electricity bills still use browser storage and are not yet synced to the backend. Optional Aadhaar store/read calls go through the encrypted Edge Function after the vault migration and secrets are configured.

## Set up the backend

1. Create a Supabase project in South Asia (Mumbai / `ap-south-1`).
2. Apply `supabase/migrations/202611020001_initial_schema.sql` using Supabase CLI or SQL Editor.
3. Configure email sign-in and owner accounts. Keep service-role secrets server-side; only the publishable key belongs in a browser app.
4. Configure backups, MFA for the owner account, and private storage buckets if adding documents.

## Deploy

Connect this Git repository to a commercial hosting provider such as Vercel, set the root to this folder, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, and deploy. Vite's build command is `npm run build`, output directory `dist`.

Before deployment with real resident data, complete authentication/database integration in the UI, configure production RLS and backups, and review Aadhaar and privacy requirements. Automated WhatsApp delivery also needs a WhatsApp Business Platform account and backend integration.

## Optional Aadhaar vault backend

An optional Aadhaar vault migration and Edge Function are provided separately from resident records:

- Apply `supabase/migrations/202611020002_aadhaar_vault.sql` after the initial schema.
- Deploy `supabase/functions/aadhaar-vault` with JWT verification enabled.
- Configure Edge Function secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `AADHAAR_ENCRYPTION_KEY`. The 256-bit AES key must be generated securely and stored only in the server secret manager; never put it in VITE-prefixed variables, browser code, Git, or a mobile bundle.
- The function encrypts before writing, verifies property ownership on each operation, returns plaintext only on authenticated reads, and logs store/read/delete actions. Set `APP_ORIGIN` to the exact deployed app origin; it may contain a comma-separated allowlist such as `https://your-production-domain.vercel.app,http://localhost:5173`. The function rejects requests from origins not listed.

This technical design is not by itself proof of Aadhaar compliance. UIDAI guidance for covered entities calls for a dedicated Aadhaar Data Vault, reference keys across business systems, approved key protection, strict access controls, and monitoring. Confirm authorization and current requirements before storing real numbers: [UIDAI Aadhaar Data Vault FAQ](https://uidai.gov.in/images/FAQs_Aadhaar_Data_Vault_03112025_v10.pdf), [UIDAI 2025 circular](https://uidai.gov.in/images/Circular-No.14_of-2025.pdf).

## Owner sign-in setup

Email/password sign-up requires email confirmation unless confirmation is disabled in Supabase Auth settings. After signing up, check the inbox for the confirmation link and then sign in.

To enable Google sign-in, configure the Google OAuth client in Google Cloud Console, add its client ID and secret under Supabase **Authentication → Sign In / Providers → Google**, and add the Supabase callback URL shown on that provider page to the Google OAuth client's authorized redirect URIs. In Supabase **Authentication → URL Configuration**, add the local URL (`http://localhost:5173`) and the deployed app URL to the allowed redirect URLs. The sign-in screen's Google button will redirect back to the current app origin.

## Building setup

First owner sign-in routes to property setup. The owner enters property name/address and adds each flat or room with floor and bed count. Flats are saved in Supabase; resident assignment and electricity bill selection use these saved flat names. Apply `supabase/migrations/202611020003_property_setup.sql` before launching this setup flow. Existing flats with active residents cannot be removed in setup until those residents are moved.

Flat setup records the **number of rooms** per flat, not the number of beds. Apply migration `202611020004_room_count.sql` after `202611020003_property_setup.sql` to rename the database field while preserving existing values.

Flat setup also has optional per-flat Wi-Fi network and password fields, editable later from Settings → Edit building details. Apply `supabase/migrations/202611020005_flat_wifi.sql` first. These fields are owner-only under the existing flat RLS policy; do not share them in resident messages.

If property setup reports an owner foreign-key error, apply migration `202611020006_property_owner_default.sql`. Property creation now omits a client-supplied owner ID; Postgres assigns `auth.uid()` from the signed-in Supabase request.

Resident entry captures single/double sharing and optional deposit amount. Residents can be archived from the Residents list; their transaction history is retained. Apply migration `202611020007_resident_sharing_deposit.sql` before using these fields.

Electricity bills and their payments are stored in Supabase. The owner can record full or partial payments against each bill; status updates to Paid once payments cover the amount. Apply `supabase/migrations/202611020008_electricity_payments.sql` before using the payment action.


The owner app refreshes resident, rent, flat, and electricity records through Supabase Realtime. Apply `supabase/migrations/202611020009_enable_realtime.sql` to add these tables to the `supabase_realtime` publication.
