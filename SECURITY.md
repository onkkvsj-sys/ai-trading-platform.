# Security Policy

## Reporting a vulnerability

Do not post credentials, access tokens, private customer information, or exploitable vulnerability details in a public issue. Contact the repository owner privately through GitHub's private vulnerability reporting feature if it is enabled for this repository.

## Security-critical areas

Please treat changes to these areas as security-sensitive:

- Supabase authentication, roles, and row-level security policies.
- Customer profile, funding, account-credit, withdrawal, and message queries.
- Storage bucket policies and signed-URL handling.
- Admin account-credit and request-review operations.
- Payment, bank, or exchange integrations.

## Deployment rules

- Never expose a Supabase service-role key or provider secret in browser code.
- Verify payment-provider webhooks on a trusted server before recording a real deposit or payout.
- Do not treat a customer-submitted request or an administrator status change as proof that money moved.
- Keep repository access limited to trusted accounts and enable GitHub branch/ruleset protection. CODEOWNERS alone does not prevent direct pushes.
