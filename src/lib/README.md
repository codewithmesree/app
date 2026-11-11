# Server and feature modules

This directory contains the implemented server-side services. Modules that access secrets, Prisma, or payment state must remain server-only and must not be imported by client components.

| Location | Responsibility |
|---|---|
| `src/lib/auth/`, `src/lib/preferences/` | Anonymous session lifecycle, session ownership, and preference persistence |
| `src/lib/merchants/`, `src/lib/qr/` | Demo merchant catalogue, server-owned sample amounts, and strict QR identifier resolution |
| `src/lib/fx/` | Frankfurter/ECB indicative quotes, cache policy, and immutable quote snapshots |
| `src/lib/payments/`, `src/lib/paypal/` | Transaction eligibility, PayPal Sandbox orders/captures, verification, idempotency, and reconciliation |
| `src/lib/logging/`, `src/lib/rate-limit/` | Structured redacted logs and in-memory demo rate limits |
| `src/lib/validation/`, `src/lib/currency/` | Request schemas and decimal-safe currency calculations |

`src/app/api/` handlers authenticate, validate, call these services, and serialize safe responses. Client state is presentation only: the server owns transaction status, payment eligibility, and receipt ownership.

There is no integrated AI provider or real bank integration in this prototype. The guidance page is static FAQ content and bank-linking records are explicitly simulated.
