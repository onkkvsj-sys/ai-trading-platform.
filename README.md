# Apex Terminal — Private AI Trading Platform

A polished, mobile-friendly terminal with public cryptocurrency market data, simulated trading, authenticated customer accounts, and a Supabase-backed support/funding workflow.

## Files

- `index.html` — responsive terminal, live public price feed and chart, simulated positions, welcome gift card, top-up request page, inbox, activity history and admin controls.
- `supabase-backend.js` — Supabase email/password authentication, cloud loading/saving for top-up requests, messages and attachments, welcome gift settings, simulated orders, activity history, and role-based admin UI gating. It uses only the public publishable key.
- `supabase/schema.sql` — database schema, RLS policies, profile bootstrap trigger, simulated order state, and private chat storage bucket/policies.

## Supabase project

A dedicated Supabase project named **AI Trading Platform** was created for this repository. Its project URL is `https://jyztynjxivznjqnncyev.supabase.co`. The schema and private attachment bucket were applied to that project. The browser code contains the project's publishable key only; never place a service-role key in client code.

## Current behavior

- Customer accounts use Supabase Auth. New signups receive a customer profile via a database trigger.
- Customer top-up requests are stored centrally and remain pending until an administrator reviews them. Approval/rejection updates request status only; it does not claim a payment was received or credit a cash balance.
- Welcome gift title, amount and terms are stored in `app_settings` and shared across accounts. The gift is explicitly promotional preview credit, not cash or withdrawable funds.
- Customer/admin messages are persisted in the database. Photos and audio attachments use a private Storage bucket with short-lived signed URLs.
- Simulated orders are stored in `simulated_orders`; the UI does not send exchange orders.
- Public crypto prices are fetched from CoinGecko. The provider may rate-limit or fail; the app shows unavailable data rather than inventing prices.
- Virtual buying power is a simulated trading amount only. It is not a bank balance, deposit, investment account or withdrawable money.

## Required owner setup

1. Deploy the branch `feature/transparent-trading-platform` (or merge its pull request) to your static host. Ensure `index.html` and `supabase-backend.js` are deployed at the same path.
2. In Supabase Auth settings, configure your production site URL and allowed redirect URLs. Enable email confirmation if desired.
3. Create your owner account through the website. New accounts intentionally start as customers.
4. Promote only your verified owner profile to administrator from the Supabase SQL editor, replacing the placeholder with the UUID for your signed-in account:
   ```sql
   update public.profiles set role = 'admin'
   where id = '<your-verified-auth-user-uuid>';
   ```
   The UUID is available in Supabase Authentication → Users. Never add public self-service admin signup or put a service-role key in the browser.
5. Sign out and back in after the role change. The Admin Center will then be visible only to the verified admin profile.

## Financial integrity and scope

This branch is not connected to a bank or payment processor. It does not execute real trades, accept deposits, transfer money, or process withdrawals. A top-up request is not payment verification. Any future real-money functionality requires a regulated payment provider, trusted server-side webhook verification, audit controls, and separate security review.

## Review

Changes are proposed in draft pull request [#1](https://github.com/onkkvsj-sys/ai-trading-platform./pull/1). The default `main` branch has not been changed by this work.
