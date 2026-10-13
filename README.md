# Apex Terminal — AI Trading Platform

A mobile-first cryptocurrency market terminal with live public market quotes, authenticated customer accounts, a private support inbox, account-funding requests, an account-credit ledger, withdrawal requests, and an administrator workspace.

The interface is designed to feel like a polished trading terminal while keeping account permissions and payment status explicit.

## Product capabilities

### Customer workspace
- Email/password registration, sign-in, sign-out, and account recovery through Supabase Auth.
- Market overview and price charts powered by public CoinGecko market data. Quote availability and refresh frequency depend on the provider.
- Prominent dashboard cards show **Total Deposits** and **My Earnings** side by side. For example, a $500 recorded deposit and $0 earnings display as **$500.00 deposits** and **$0.00 earnings**; an administrator earnings credit updates the earnings card after the customer data refreshes.
- Account overview and ledger separate deposits/top-ups, platform-recorded trading results, earnings credits, and withdrawal requests.
- Funding-request submission and status history.
- Private customer/administrator messaging, including photo and audio attachments stored in a private Supabase Storage bucket.
- Activity history and CSV export.
- Profile and account settings.

### Administrator workspace
- Administrator-only customer and platform controls, gated by the customer's database role.
- Review of customer funding and withdrawal requests.
- A customer-credit form that records the exact amount and one of two categories. The dashboard reloads the account ledger after a credit is saved:
  - **Deposit / top-up:** added to the platform's available trading balance.
  - **Earnings credit:** displayed separately and excluded from available trading funds.
- Global welcome-benefit settings and customer support tools.
- Account credits are recorded in a database ledger with row-level security; customers can read only their own records, while authorized administrators can create credits.

## Trading and payment scope

**Market quotes are public market data. Orders placed in this workspace are recorded by this platform and are not routed to a cryptocurrency exchange.** Trading results are account records, not evidence of an executed exchange trade or a cash payment.

The website does not currently connect to a bank, payment processor, or exchange execution API. A funding request is not proof of payment. Changing a request's status does not send money. A withdrawal request is a request for review, not a completed payout. Before enabling real-money operations, add a trusted server-side payment integration, verify provider webhooks, reconcile deposits and payouts, and obtain any required legal and regulatory review.

## Repository layout

| Path | Purpose |
| --- | --- |
| `index.html` | Responsive terminal UI, market views, customer pages, account ledger, and administrator interface. |
| `supabase-backend.js` | Supabase Auth integration, persistent account workflows, messages, private attachment URLs, account credits, and admin UI gating. |
| `supabase/schema.sql` | Reference SQL for the database schema, role protections, row-level security, indexes, and storage policies. |
| `.github/CODEOWNERS` | Identifies the repository owner as the reviewer for repository files. |
| `.github/workflows/validate.yml` | Syntax checks for the browser scripts on pushes and pull requests. |
| `SECURITY.md` | Security-reporting and deployment-hardening guidance. |

## Supabase configuration

The application uses the dedicated Supabase project named **AI Trading Platform**:

- Project URL: `https://jyztynjxivznjqnncyev.supabase.co`
- Browser client: the public/publishable key only.
- Never put a Supabase service-role key, payment secret, bank credential, or other privileged secret in `index.html`, `supabase-backend.js`, or any other client-side file.

The deployed database has row-level security on customer records and account credits. Administrator actions are checked against the authenticated account's database role; hiding an admin button in the browser is not a security boundary by itself.

### Owner account setup

1. In Supabase Authentication, create the owner account through the website and complete email confirmation if enabled.
2. Find that account's verified Auth user UUID in **Authentication → Users**.
3. In the Supabase SQL Editor, promote only that verified owner account:

   ```sql
   update public.profiles
   set role = 'admin'
   where id = '<verified-owner-auth-user-uuid>';
   ```

4. Sign out of the website and sign back in.
5. Confirm the Admin Center appears only for the administrator account and test a separate customer account to confirm that it cannot access admin operations.

Do not add public self-service administrator signup. Do not promote an account using an email address alone; use the verified Auth user UUID.

## Deployment

The live Render Static Site is configured to deploy from `feature/transparent-trading-platform`:

- Site: [AI Trading Bot](https://ai-trading-platform-1-lgu8.onrender.com)
- Hosting: Render Static Site
- Publish directory: `.`
- Build command: none required for the current static frontend.
- Supabase URL and public/publishable key are configured in the browser client.

Keep `index.html` and `supabase-backend.js` at the same published path. After changing frontend code, confirm the Render deployment is live and test sign-in, customer/admin separation, account credits, funding requests, messaging, and withdrawal-request validation.

## Code and account security

- Use a private repository if the source code should not be publicly visible.
- Keep repository write access limited to the owner and trusted collaborators.
- Configure a GitHub ruleset or branch protection for `main`: require pull requests, require an owner/code-owner review where practical, block force pushes and branch deletion, and prevent bypass where supported.
- Apply a separate protection rule to the deployed branch if it should not accept unreviewed changes.
- `CODEOWNERS` requests owner review but **does not enforce protection by itself**; repository rules must be enabled in GitHub Settings.
- Use unique passwords and multi-factor authentication for GitHub, Render, and Supabase.
- Never commit service-role keys, access tokens, payment secrets, or bank credentials.
- Review Supabase RLS policies whenever a table, view, RPC, or storage bucket is added.

## Validation

The GitHub Actions workflow checks the JavaScript syntax of `supabase-backend.js` and the inline scripts in `index.html`. A successful syntax check does not replace browser testing or a security review of live database policies.

## Project status

This is an actively deployed frontend and Supabase-backed account workflow. The public market feed is not an exchange connection, and no live bank/payment or exchange-execution integration is configured.
