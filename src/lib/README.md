# Module boundaries

Where each concern lives as the app grows. Folders are created with their first
real file (architecture.md section 4), so most of the server modules below don't
exist yet.

| Location | Holds | Runs on |
|---|---|---|
| `src/app/` | Routes and layouts only; pages compose components | Server by default |
| `src/components/ui`, `layout`, `motion` | Design system, app shell, motion wrappers | Either |
| `src/components/<feature>` | Presentation for one feature; receives typed data | Either |
| `src/features/<feature>` | Types, UI state, status wording and clearly labelled sample data | Either |
| `src/lib/currency`, `src/lib/validation` | Pure logic with no I/O | Either |

Planned server-only modules. Each must start with `import "server-only"` and is
never imported by a client component:

| Location | Holds | Specified in |
|---|---|---|
| `src/app/api/` | Route handlers: validate, resolve the session, call a service, serialise | api-contract.md |
| `src/lib/db.ts`, `prisma/` | Prisma client, MySQL schema and migrations | database-schema.md |
| `src/lib/auth/` | Demo session and transaction ownership checks | api-contract.md section 2 |
| `src/lib/paypal/` | PayPal Sandbox client and response verification | payment-flow.md |
| `src/lib/payments/` | State machine, idempotency, reconciliation | payment-flow.md |
| `src/lib/currency/` (provider) | Rate provider client and staleness policy | architecture.md section 5.4 |
| `src/lib/qr/` | Demo QR schema and parser | architecture.md section 5.6 |
| `src/lib/ai/` | LLM client and read-only tools | architecture.md section 5.5 |
| `src/lib/rate-limit/`, `src/lib/logging/` | Rate limits and log redaction | threat-model.md |

Rules that hold everywhere: components never query the database or decide payment
state, and the browser is never the authority for transaction completion.

Mock data lives only in `features/*/sample-*.ts`, and each file says so at the top.
