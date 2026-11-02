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

The current UI is still the working browser prototype and saves sample operations locally. The schema is ready for the next integration step; live Supabase authentication and database reads/writes are not connected yet.

## Set up the backend

1. Create a Supabase project in South Asia (Mumbai / `ap-south-1`).
2. Apply `supabase/migrations/202611020001_initial_schema.sql` using Supabase CLI or SQL Editor.
3. Configure email sign-in and owner accounts. Keep service-role secrets server-side; only the publishable key belongs in a browser app.
4. Configure backups, MFA for the owner account, and private storage buckets if adding documents.

## Deploy

Connect this Git repository to a commercial hosting provider such as Vercel, set the root to this folder, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, and deploy. Vite's build command is `npm run build`, output directory `dist`.

Before deployment with real resident data, complete authentication/database integration in the UI, configure production RLS and backups, and review Aadhaar and privacy requirements. Automated WhatsApp delivery also needs a WhatsApp Business Platform account and backend integration.
