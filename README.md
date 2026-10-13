# Apex Terminal — Private AI Trading Platform

A mobile-friendly trading dashboard preview with live public market-price lookups and **simulated execution only**.

## What's included

- `index.html` — responsive terminal UI, public crypto price feed, chart/watchlist, transparent strategy summary, simulated orders, top-up request workflow, editable welcome-credit settings, preview support inbox with image/audio attachments, local activity ledger, CSV export.
- `supabase/schema.sql` — starter PostgreSQL schema and row-level security policies for authenticated profiles, settings, top-up requests, private messages, activity events, and simulated orders.

## Important current limitations

- The current browser UI is a **preview**. It stores its state in the current browser's local storage, so it is not yet persistent across devices or shared with another customer/admin session.
- The admin/customer switch is a visual preview control, **not authentication**. Do not deploy the current static page as a live financial service.
- Market data is fetched from a public CoinGecko endpoint when available. The feed may fail or be rate limited; the UI should show unavailable data rather than invent prices.
- Orders are recorded as simulated previews only. No exchange orders, bank transfers, deposits, or withdrawals are sent.
- A top-up request is not proof of payment. Before crediting real money, verify payment through a trusted payment provider/server-side webhook. Do not ask customers to pay an unrelated fee to release a withdrawal.
- The welcome credit is promotional preview credit, not cash and not withdrawable.

## To enable persistent multi-user use

1. Create a Supabase project and enable email/password authentication.
2. Apply `supabase/schema.sql` in the Supabase SQL editor.
3. Sign in as the intended owner, verify the Auth user UUID, and securely promote that profile to `admin` using the SQL comment at the end of the schema. Do not allow client-side role changes.
4. Create a **private** Storage bucket named `chat-attachments` and configure object policies so only the conversation owner and admin can access attachments. Use signed URLs for display.
5. Add a backend/serverless API to validate sessions and roles, perform top-up review atomically, verify real payments server-side, and persist/retrieve messages and attachments. Never put a Supabase service-role key or exchange secret in browser code.
6. Replace localStorage preview state with authenticated Supabase queries and realtime subscriptions; test customer/admin isolation before launch.

## Deploy

This is currently a static HTML preview. Open `index.html` locally or deploy the file as a static site. Configure a backend and authentication before making it available for real customer data.

## Safety

This project is not a broker or financial institution. The interface makes no promise of profit. Public market prices are informational only; simulated results must not be presented as real trades or account balances.