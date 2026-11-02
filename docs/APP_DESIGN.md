# Staywise PG Manager

## 1. Product purpose

Staywise is an owner-first operating system for a PG or co-living property. It helps the owner manage buildings, flats, rooms, residents, rent, deposits, electricity charges, payments, reminders, and reports from one responsive web app.

The current release is designed for the owner. A future team-access release can add a partner or manager account with controlled permissions.

## 2. Primary users

### Owner

The owner creates the account, sets up the property, adds flats and rooms, manages residents, records payments, creates electricity bills, and reviews reports.

### Partner or manager (planned)

The partner will use a separate login connected to the same property. A future role system should support at least owner, manager, and viewer.

### Resident (planned)

Residents may later receive a separate portal or mobile experience to view dues, bills, payment history, and notices.

## 3. Main application workflow

Flow:

Email/password sign-up -> Property setup -> Owner dashboard

From the dashboard:

- Residents: add, edit, archive, sharing type, and deposit.
- Rent and payments: monthly due status, payment entry, and individual reminder.
- Electricity bills: choose flat, enter readings, calculate split, and record payments.
- Reports: rent, electricity, meter history, and collections.
- Messages: review WhatsApp draft and open WhatsApp.

## 4. Resident lifecycle

1. Add a resident and assign a flat.
2. Select single or double sharing and enter monthly rent and deposit.
3. Optionally assign the resident to Room 1 · Left meter or Room 2 · Right meter for electricity allocation.
4. Record rent payments. The system keeps one monthly rent record per resident.
5. Edit resident details when rent, room, phone, sharing, or deposit changes.
6. Use the individual rent reminder action when the current monthly balance is unpaid.
7. Archive the resident when they move out. Historical rent and electricity records remain retained.

The dashboard deposit total is calculated from the remaining resident records. If a resident with a ₹2,000 deposit is removed from a ₹10,000 total, the dashboard shows ₹8,000.

## 5. Rent workflow

Rent is due on the 2nd of each month. The dashboard calculates expected rent, rent collected for the current month, unpaid or part-paid balance, and resident-level status: Paid, Part paid, Due, or Overdue.

The owner can record a full or partial payment. The payment action uses an atomic monthly upsert so repeated submissions do not create duplicate monthly rows. An individual reminder creates a reviewable WhatsApp draft with the resident name, month, due date, and outstanding amount.

## 6. Electricity bill workflow

Electricity is managed one flat at a time.

1. Choose the flat and billing month.
2. Enter the flat’s main electricity bill amount.
3. Enter the building-wide common meter charge.
4. Enter previous and current readings for Room 1 · Left meter and Room 2 · Right meter.
5. The previous reading is prefilled from the flat’s latest saved cycle. If history is unavailable, the owner enters it.
6. Assign each selected resident to the left or right meter.
7. The system calculates units, meter percentages, room allocations, and resident amounts.
8. Common charges are divided by active flat count and then equally among selected residents in the chosen flat.
9. The calculated resident amount remains editable so the owner can apply a manual adjustment.
10. The owner reviews the read-only WhatsApp preview, saves bills, and can record full or partial electricity payments.

Calculation:

left units = left current reading - left previous reading

right units = right current reading - right previous reading

total units = left units + right units

left main share = main flat bill × left units / total units

right main share = main flat bill × right units / total units

common share per resident = building common charge / active flat count / selected residents in flat

resident amount = room main share / residents assigned to that meter + common share per resident

Meter readings are stored by property, flat, and billing cycle, and are shown in reports with reading dates, previous readings, current readings, units, main bill, and common charge.

## 7. Dashboard and reports

The Overview page shows occupancy, rent collected, pending rent, deposits, and a due list containing unpaid rent and unpaid electricity balances.

Reports support a selected month and show expected rent, collected rent, outstanding rent, resident-level rent status, electricity billed, collected and outstanding, payment counts, and meter history by flat and bill cycle.

## 8. Messaging

The app prepares WhatsApp drafts. It does not automatically send messages. The owner reviews the draft and presses the WhatsApp action.

Supported drafts are generic rent reminders, individual rent reminders, and electricity bill group messages with resident names and amounts.

## 9. Technical architecture

Frontend:

- HTML, CSS, and vanilla JavaScript
- Vite build tooling
- Responsive desktop and mobile layout
- Progressive Web App manifest and service worker
- Supabase JavaScript client

Backend:

- Supabase PostgreSQL
- Supabase Auth with email/password sign-in
- Row-Level Security policies
- Supabase Realtime subscriptions
- SQL migrations in supabase/migrations

Hosting:

- Vercel hosts the Vite production build
- GitHub main is the deployment source
- Build command: npm run build
- Output directory: dist

The browser uses only the Supabase URL and publishable key. Service-role or secret keys must stay server-side. Aadhaar is no longer part of the product.

## 10. Core data model

auth.users -> properties -> flats -> residents

properties -> rent_payments

flats -> electricity_meter_readings

properties -> electricity_bills -> electricity_bill_payments

Important rules:

- every property record belongs to an authenticated owner;
- flats belong to one property;
- residents belong to one flat and can be archived;
- rent payments are unique per resident and month;
- electricity meter readings are unique per flat and billing cycle;
- electricity bill payments belong to one electricity bill;
- RLS policies restrict records to the property owner.

## 11. Repository structure

- index.html: UI and client-side workflows.
- src/cloud.js: Supabase session, reads, writes, and realtime.
- public/manifest.webmanifest: PWA metadata.
- public/sw.js: service worker.
- supabase/migrations/: database schema and incremental changes.
- docs/APP_DESIGN.md: this product and technical design.

## 12. Local development and deployment

1. Run npm install.
2. Create .env from .env.example.
3. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
4. Run npm run dev.

For production, connect the repository to Vercel, configure the same VITE variables, and deploy from main. Apply the Supabase migrations in order before using the corresponding feature.

## 13. Planned next milestones

1. Team access with partner invitations and owner-controlled roles.
2. Move payment and activity history fully away from browser storage.
3. Resident portal with read-only bills and payment history.
4. WhatsApp Business delivery and message audit history.
5. Deposit refund and adjustment ledger.
6. Native mobile wrapper after the PWA workflow is stable.
7. Automated backups, audit events, and stronger operational monitoring.
