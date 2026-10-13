# AI Trading Bot — Apex Terminal

A mobile-first cryptocurrency market terminal with live public market quotes, authenticated customer accounts, a private support inbox, funding requests, an account-credit ledger, withdrawal requests, and an administrator workspace.

The active Render deployment is built from `feature/transparent-trading-platform`. The default `main` branch is the original frontend baseline; keep the deployment branch and the default branch clearly identified when reviewing changes.

## Customer features

- Email/password sign-up, sign-in, sign-out, and account recovery through Supabase Auth.
- Cryptocurrency market overview and charts using public CoinGecko market data.
- Account activity with separate records for deposits/top-ups, platform-recorded trading results, earnings credits, and withdrawal requests.
- Funding-request submission and status history.
- Private customer/administrator messaging, including photo and audio attachments in a private Supabase Storage bucket.
- Profile settings, account activity, and CSV export.

## Administrator features

- Administrator-only controls based on the authenticated user's database role.
- Review of customer funding and withdrawal requests.
- Exact account credits with two categories:
  - **Deposit / top-up:** recorded in the platform's available trading balance.
  - **Earnings credit:** recorded separately and excluded from available trading funds.
- Global welcome-benefit settings and customer support tools.
- Row-level security policies restrict customer records to the account owner and authorized administrators.

## Trading, deposits, and withdrawals

Market quotes are public market data. **Orders placed in this workspace are recorded by this platform and are not routed to a cryptocurrency exchange.** Trading results are account records, not evidence of an executed exchange trade or a cash payment.

The application is not currently connected to a bank, payment processor, or exchange-execution API. A funding request is not proof of payment, and changing its status does not send money. A withdrawal request is a request for review, not a completed payout. Real-money operations require a trusted server-side payment integration, verified provider webhooks, reconciliation, and any applicable legal and regulatory review.

## Repository layout

- `index.html` — responsive terminal UI, market views, customer pages, account ledger, and administrator interface.
- `supabase-backend.js` — Supabase Auth integration, persistent account workflows, messaging, private attachment URLs, account credits, and admin UI gating (present on the active deployment branch).
- `supabase/schema.sql` — reference SQL for database tables, role protections, row-level security, indexes, and storage policies.
- `.github/CODEOWNERS` — assigns the repository owner as code owner.
- `.github/workflows/validate.yml` — syntax validation for browser JavaScript.
- `SECURITY.md` — security reporting and hardening guidance.

## Supabase configuration

The dedicated Supabase project is **AI Trading Platform**:

- Project URL: `https://jyztynjxivznjqnncyev.supabase.co`
- The browser client uses a public/publishable key only.
- Never put a service-role key, payment secret, bank credential, or other privileged secret in browser code.

Database row-level security is enabled for customer records and account credits. Administrator actions must be authorized by the database role; hiding an admin button in the browser is not a security boundary by itself.

### Owner administrator setup

1. Create the owner account through the website and complete email confirmation if enabled.
2. Find the verified account's UUID in Supabase **Authentication → Users**.
3. In the Supabase SQL Editor, promote only that verified account:

   ```sql
   update public.profiles
   set role = 'admin'
   where id = '<verified-owner-auth-user-uuid>';
   ```

4. Sign out and back in.
5. Test with a separate customer account to confirm that it cannot access administrator operations.

Do not add public self-service administrator signup. Do not promote an account based only on an email address.

## Render deployment

- Live site: [AI Trading Bot](https://ai-trading-platform-1-lgu8.onrender.com)
- Host: Render Static Site
- Deploy branch: `feature/transparent-trading-platform`
- Publish directory: `.`
- Build command: none required for the current static frontend.

Keep `index.html` and `supabase-backend.js` together in the published directory. After a deployment, test authentication, customer/admin separation, credits, funding requests, messaging, and withdrawal validation.

## Protecting the source code

The repository is currently **public**, so anyone can read or copy the source. Public visibility does not automatically grant strangers write access, but it is not suitable if the source itself must be private.

Recommended GitHub settings:

1. Change repository visibility to **Private** if the source must not be publicly viewed.
2. Remove unrecognized collaborators and grant write access only to trusted accounts.
3. Create an active ruleset or branch-protection rule for `main` and the deployment branch.
4. Require pull requests for changes, request code-owner review, block force pushes and branch deletion, and disable bypass where supported.
5. Keep `CODEOWNERS` in the base branch. **CODEOWNERS alone does not enforce protection**; the GitHub rules must also be enabled.
6. Enable multi-factor authentication on GitHub, Render, and Supabase. Never commit secrets.

The current connected GitHub actions can read and commit repository files, but do not expose a write operation for repository visibility or branch-protection/ruleset settings. Those account-level settings must be saved in GitHub Settings before the repository can be described as locked.

## Validation

The GitHub Actions workflow checks JavaScript syntax in `supabase-backend.js` when present and validates the inline scripts in `index.html`. Syntax validation does not replace browser testing or a review of the live database policies.
