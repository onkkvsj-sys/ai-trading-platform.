# Apex Terminal — Private AI Trading Platform

A polished, mobile-friendly trading terminal preview with public cryptocurrency prices and simulated order execution.

## Included in this branch

- `index.html` — responsive trading terminal, market watchlist and chart, public price lookups, descriptive market summary, simulated order creation and closing, open-position P/L estimates, editable welcome-credit card and admin settings, top-up request submission and approval queue, customer/admin preview inbox with image/audio attachments, activity ledger and CSV export.
- `supabase/schema.sql` — starter schema and row-level security policies for authenticated profiles, settings, top-up requests, private messages, activity events, and simulated orders.

## Status and limitations

- The top-right `PREVIEW` marker is intentionally discreet. Simulated execution is identified where users create and review preview orders; the rest of the UI avoids repeated demo banners.
- Browser state is currently stored in local storage. It does not yet provide shared customer accounts, durable cross-device messages, or server persistence.
- The admin/customer switch is a visual preview control, not authentication. Do not expose this static preview as a live multi-customer service.
- Public crypto prices are fetched from CoinGecko when available. The provider can rate-limit or fail; unavailable data is shown as unavailable rather than invented.
- Orders and P/L calculations are simulated previews only. No exchange order, bank transfer, deposit, or withdrawal is executed.
- A top-up request does not prove payment. Real balance credits require payment verification on a trusted server-side provider webhook.

## Steps required for a complete production deployment

1. Create or select a dedicated Supabase project for this trading platform. Do not reuse unrelated project databases.
2. Enable Supabase Auth, apply `supabase/schema.sql`, and securely promote the verified owner profile to admin using the SQL comment at the end of the schema.
3. Configure a private `chat-attachments` Storage bucket with owner/admin policies and signed URLs.
4. Add authenticated API endpoints for role-checked admin actions, payment verification, atomic top-up approval, and message/attachment operations.
5. Connect the UI to Supabase Auth, database queries and realtime subscriptions. Remove the local-only preview switch once server-side roles are live.
6. Test account isolation, upload access, top-up approval/rejection, and persistence on mobile before deployment.

## Deploy

The current app is a static HTML preview. It can be reviewed on a static host, but the secure backend steps above must be completed before it is used with real customers.

## Financial integrity

Public market data is informational. Simulated orders and estimates must not be represented as actual exchange executions or guaranteed returns. Do not display a transfer as completed until confirmed by the payment provider.