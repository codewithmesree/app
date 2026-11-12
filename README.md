# GlobalPay

GlobalPay is a cross-border payment prototype for international travellers. A traveller picks a destination, compares indicative exchange rates, chooses a local merchant, pays in the merchant's local currency through **PayPal Sandbox**, and can ask a **Gemini-powered assistant** general questions about paying abroad.

It is built with Next.js, React, TypeScript, Prisma and MySQL, and was created for the PayPal AI Hackathon 2026.

> **Prototype status:** GlobalPay is a hackathon prototype, not a production service. All payments use PayPal **Sandbox** (no real money moves), bank linking is **simulated**, and exchange rates are **indicative**. It has not been deployed or security-audited for production use.

## Contents

- [Problem statement](#problem-statement)
- [Solution and target users](#solution-and-target-users)
- [Key features](#key-features)
- [AI functionality](#ai-functionality)
- [Technology stack](#technology-stack)
- [Architecture overview](#architecture-overview)
- [Project structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation and local development](#installation-and-local-development)
- [Environment variables](#environment-variables)
- [Database setup and Prisma migrations](#database-setup-and-prisma-migrations)
- [PayPal Sandbox configuration](#paypal-sandbox-configuration)
- [Gemini API configuration](#gemini-api-configuration)
- [Foreign exchange provider](#foreign-exchange-provider)
- [Testing](#testing)
- [Known limitations](#known-limitations)
- [Privacy and data handling](#privacy-and-data-handling)
- [Security considerations](#security-considerations)
- [Licence](#licence)

## Problem statement

Paying abroad is confusing. Travellers face unfamiliar currencies, unclear conversion rates and uncertainty about whether a payment actually went through. Card terminals and checkout pages often show a converted amount without explaining where the rate came from, and a payment that hangs or fails mid-way leaves people unsure whether to try again and risk paying twice.

## Solution and target users

GlobalPay is aimed at **international travellers** who want to pay local merchants in the local currency and understand what they are paying in their home currency.

The prototype demonstrates:

- **Transparent conversion:** indicative rates from the European Central Bank (via Frankfurter), always labelled as estimates rather than guaranteed checkout rates.
- **Server-trusted payments:** the server, not the browser, decides the amount, creates the PayPal order, captures it and verifies the result with PayPal.
- **Safe outcomes:** duplicate clicks, page reloads and network timeouts cannot create a second capture, and an uncertain result is reconciled with PayPal rather than guessed.
- **Guidance:** an AI assistant that explains travel payment concepts in plain language without being able to touch payments.

## Key features

All of the following are implemented in this repository:

| Area | What it does |
|---|---|
| **Onboarding and sessions** | Anonymous demo sessions stored server-side and restored from an HttpOnly cookie. Home country, display currency and destinations are saved per session. No sign-up or personal details are required. |
| **Traveller dashboard** | Travel information for the chosen destination, an indicative rate card, recent activity, sample merchants and quick links. |
| **Exchange rate insights** | Indicative rates between INR, JPY, GBP, EUR, SGD and USD from ECB reference data, cached server-side and shown with their source and timestamp. |
| **Merchant discovery** | A curated catalogue of 15 demo merchants (three each in Japan, the United Kingdom, France, Singapore and the United States), each with a fixed, server-configured sample amount in its local currency. |
| **Demo QR selection** | The Scan page lets you pick one of the merchants' demo QR identifiers, which the server validates strictly. It does not use the camera. |
| **Simulated bank linking** | A mock bank-connection flow (clearly labelled as simulated) that stores only a masked account number. A linked bank is required before paying. |
| **PayPal Sandbox checkout** | Server-created PayPal orders, buyer approval on PayPal Sandbox, server-side capture and verification of order ID, amount, currency and payee. |
| **Automatic payment confirmation** | After PayPal approval, the return page captures automatically and keeps reconciling for about 60 seconds if PayPal's answer is delayed, then redirects to the dashboard once the payment is confirmed. A manual "Check Status Again" fallback remains. |
| **Cancel and failure handling** | Cancel returns are verified with PayPal before a payment is marked cancelled. Captures PayPal reports as declined are recorded as failed; ambiguous outcomes are kept as "under review", never guessed. |
| **Transaction history and receipts** | Per-session history and receipt pages; one session cannot read another session's transactions. |
| **Travel payment assistant** | A Gemini-powered informational chat. See [AI functionality](#ai-functionality). |

## AI functionality

The **Assistant** page (`/assistant`) is a chat backed by Google's Gemini API.

**What it can help with.** The assistant is instructed to answer general questions about:

- how GlobalPay's demo payments work and what PayPal Sandbox means;
- travel payment concepts (paying in local currency, currency conversion);
- why exchange rates shown in the app are indicative;
- what simulated bank linking means;
- payment security habits (for example, never sharing passwords or card numbers).

Suggested starter questions in the UI include "How do demo payments work?", "Why are exchange rates indicative?" and "What does simulated bank linking mean?".

**What it cannot do.** The assistant is informational only:

- It **cannot initiate, approve, capture, cancel or reconcile payments**. It has no tools or functions; it only returns text.
- It **cannot access bank accounts**, the user's transactions or any database data. It is not given account data.
- It **does not provide financial, legal or tax advice**, and it does not provide live exchange rates.
- It is instructed never to ask for passwords, card numbers or other credentials, and to treat user messages as untrusted input.

The model can still make mistakes. Treat its answers as general information.

**How it works.** The browser sends the conversation to `POST /api/assistant/chat`. The server checks the request origin and session, applies a rate limit (12 messages per minute per session), validates input (up to 12 messages of up to 4,000 characters), then calls Gemini's `generateContent` endpoint with a fixed system instruction. The API key stays on the server. See [`src/lib/ai/gemini-chat.ts`](src/lib/ai/gemini-chat.ts).

**It is optional.** If `AI_API_KEY` is empty (or `AI_PROVIDER` is not `gemini`), the rest of GlobalPay works normally. Sending a chat message then returns a clear "Travel chat is not configured" message instead of a reply. Invalid keys, unavailable models, timeouts and rate limits each return a specific, safe error message.

## Technology stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript 5 |
| Styling and motion | Tailwind CSS 4, Motion, Lucide icons |
| Database | MySQL 8 with Prisma ORM 6 |
| Validation | Zod |
| Payments | PayPal REST API v2 Orders (Sandbox only) |
| AI | Google Gemini API (`generateContent`) |
| Exchange rates | Frankfurter (European Central Bank reference rates) |
| Testing | Node.js built-in test runner (`node:test`) |

## Architecture overview

```
Browser (React client components)
   │  same-origin fetch + HttpOnly session cookie
   ▼
Next.js API routes  (src/app/api/*)
   │  origin check · session ownership · Zod validation · rate limits
   ▼
Server-only services  (src/lib/*)
   ├── auth, preferences      → anonymous sessions, ownership checks
   ├── merchants, qr          → catalogue and server-owned sample amounts
   ├── fx                     → Frankfurter rates, cache, quote snapshots
   ├── payments, paypal       → orders, capture, verification, idempotency, reconciliation
   └── ai                     → Gemini chat (informational only)
   │
   ├── Prisma → MySQL (sessions, preferences, transactions, payment attempts, audit events)
   └── External APIs: PayPal Sandbox · Google Gemini · Frankfurter
```

Key design decisions:

- **The server owns payment state.** The browser never sends an amount or a status that is trusted. Sample amounts are configured server-side per merchant, and only a capture verified against PayPal's own records can complete a transaction.
- **Idempotency and locking.** Order creation and capture use idempotency keys (stored hashed and scoped to the session), a per-payment capture lease in the database, and a stable `PayPal-Request-Id`, so retries and concurrent requests cannot capture twice.
- **Reconciliation over guessing.** Timeouts and incomplete responses are recorded as `STATUS_UNKNOWN` and later resolved by asking PayPal for the order's actual state.
- **Secrets stay server-side.** PayPal, Gemini and database credentials are read only in server-only modules.

More detail: [`src/lib/README.md`](src/lib/README.md) and the design-phase specifications in [`docs/specifications/`](docs/specifications/README.md).

## Project structure

```
.
├── docs/specifications/   Design-phase specifications (PRD, architecture, API contract, schema, payment flow, threat model, UI design)
├── prisma/
│   ├── schema.prisma      Database schema (MySQL)
│   ├── migrations/        Checked-in SQL migrations
│   └── seed.ts            Seeds the demo merchant catalogue
├── public/                Static assets and icons
├── src/
│   ├── app/               Next.js App Router
│   │   ├── (onboarding)/  Landing and onboarding pages
│   │   ├── (dashboard)/   Dashboard, rates, merchants, scan, pay, transactions, assistant, connect-bank, settings
│   │   └── api/           API route handlers
│   ├── components/        React UI components by feature
│   ├── features/          Client-side feature helpers and types
│   └── lib/               Server-side services (see src/lib/README.md)
├── tests/                 Automated tests (node:test)
├── .env.example           Documented environment variables (placeholders only)
└── LICENSE                MIT licence
```

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| **Node.js** | **22.7 or later** (developed and tested with 24.18) | Next.js 16 requires ≥ 20.9; the test script uses `--experimental-transform-types`, which needs Node ≥ 22.7. |
| **npm** | Bundled with Node.js | |
| **MySQL** | **8.0 or later** (developed with 8.0) | The schema uses `JSON`, `DATETIME(3)` and `utf8mb4`. |
| **PayPal Developer account** | Free | Needed for Sandbox credentials and test accounts. |
| **Google AI Studio API key** | Optional | Only needed for the assistant. |

## Installation and local development

Run all commands from the repository root.

**1. Install dependencies** (uses the committed lockfile):

```bash
npm ci
```

**2. Create the environment file:**

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

```bash
# macOS / Linux
cp .env.example .env
```

Then edit `.env` and replace every placeholder. See [Environment variables](#environment-variables).

> Use `.env` rather than `.env.local` for your main settings. The Next.js app reads both files, but the Prisma CLI (migrations, seeding) and `npm test` read only `.env`. Values in `.env.local` override `.env` for the Next.js app only, which can make the app and the tests use different settings.

**3. Create the databases**, apply migrations and seed the merchant catalogue. See [Database setup and Prisma migrations](#database-setup-and-prisma-migrations).

**4. Start the development server:**

```bash
npm run dev
```

Open <http://localhost:3000>. Restart the server after changing environment variables.

**Typical demo journey:** complete onboarding → connect the simulated bank (Connect Bank) → browse merchants or pick a demo QR on Scan → review the payment → approve it on PayPal Sandbox with your Sandbox buyer account → GlobalPay confirms automatically and returns you to the dashboard → view the receipt under Transactions.

### Available npm scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build (`next build --webpack`) |
| `npm run start` | Serve a production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run the automated test suite (needs a migrated database; see [Testing](#testing)) |
| `npm run db:migrate` | Apply checked-in migrations (`prisma migrate deploy`) |
| `npm run db:seed` | Seed or update the demo merchant catalogue (idempotent) |

## Environment variables

All variables are documented with placeholders in [`.env.example`](.env.example). Real `.env*` files are ignored by Git.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | Yes | – | MySQL connection string |
| `SHADOW_DATABASE_URL` | Yes (referenced by the schema) | – | Empty database Prisma uses during `prisma migrate dev` |
| `NEXT_PUBLIC_APP_URL` | Recommended | `http://localhost:3000` | Base for default PayPal return/cancel URLs and an allowed origin for CSRF checks |
| `SESSION_COOKIE_NAME` | No | `gp_session` | Session cookie name |
| `SESSION_MAX_AGE_SECONDS` | No | `86400` | Session lifetime (24 hours) |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | Yes, for checkout | – | PayPal Sandbox REST app client ID (`PAYPAL_CLIENT_ID` is accepted as an alternative name). Read on the server only. |
| `PAYPAL_CLIENT_SECRET` | Yes, for checkout | – | PayPal Sandbox client secret (server-only) |
| `PAYPAL_PAYEE_EMAIL` | Yes, for checkout | – | Email of the Sandbox business account that receives payments |
| `PAYPAL_BASE_URL` | No | `https://api-m.sandbox.paypal.com` | PayPal API base URL |
| `PAYPAL_RETURN_URL` | No | `${NEXT_PUBLIC_APP_URL}/pay/return` | Where PayPal returns the buyer after approval |
| `PAYPAL_CANCEL_URL` | No | `${NEXT_PUBLIC_APP_URL}/pay/cancel` | Where PayPal returns the buyer after cancelling |
| `AI_PROVIDER` | No | `gemini` | Only `gemini` is supported |
| `AI_API_KEY` | No (assistant only) | – | Gemini API key; leave empty to disable the assistant |
| `AI_MODEL` | No | `gemini-3.5-flash` | Gemini model ID available to your key |
| `FX_PROVIDER` | No | `frankfurter` | Only Frankfurter is implemented |
| `FX_API_KEY` | No | – | Read by the configuration but not used by Frankfurter |
| `FX_BASE_URL` | No | `https://api.frankfurter.app` | Frankfurter API base URL |
| `FX_CACHE_TTL_SECONDS` | No | `300` | Rate cache lifetime; stale rates may be served for up to twice this if the provider is unreachable |

`SESSION_SECRET` is **not** used by the application; sessions use random tokens stored as SHA-256 hashes. `NODE_ENV` is set automatically by Next.js.

## Database setup and Prisma migrations

**1. Create two databases and an application user.** Connect to MySQL as an administrator (for example `mysql -u root -p`) and run, replacing `PASSWORD`:

```sql
CREATE DATABASE globalpay_dev    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE globalpay_shadow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER 'globalpay_app'@'127.0.0.1' IDENTIFIED BY 'PASSWORD';
GRANT ALL PRIVILEGES ON globalpay_dev.*    TO 'globalpay_app'@'127.0.0.1';
GRANT ALL PRIVILEGES ON globalpay_shadow.* TO 'globalpay_app'@'127.0.0.1';
```

The grants are scoped to these two databases. The user needs schema privileges because it also applies migrations; for a stricter setup, run migrations with a separate account.

**2. Point `.env` at them:**

```dotenv
DATABASE_URL="mysql://globalpay_app:PASSWORD@127.0.0.1:3306/globalpay_dev"
SHADOW_DATABASE_URL="mysql://globalpay_app:PASSWORD@127.0.0.1:3306/globalpay_shadow"
```

URL-encode special characters in the password (for example `@` becomes `%40`).

**3. Validate the schema, generate the client, apply migrations and seed:**

```bash
npx prisma validate
npx prisma generate
npm run db:migrate
npm run db:seed
```

These commands are the same in PowerShell, macOS and Linux. `npm run db:migrate` runs `prisma migrate deploy`, which applies the checked-in migrations in [`prisma/migrations/`](prisma/migrations) without generating new ones. Only use `npx prisma migrate dev` if you are changing [`prisma/schema.prisma`](prisma/schema.prisma), and review the generated SQL before applying it.

## PayPal Sandbox configuration

GlobalPay only talks to **PayPal Sandbox**. Sandbox transactions are simulated: no real money moves and no real cards or bank accounts are charged. The server also only accepts approval links on `www.sandbox.paypal.com`.

**1. Sign in** to the [PayPal Developer Dashboard](https://developer.paypal.com/) and make sure the **Sandbox** toggle is selected.

**2. Check your Sandbox test accounts** under **Testing Tools → Sandbox Accounts**. PayPal usually creates two by default; create them if they are missing:

- a **Business** account: the merchant that receives payments;
- a **Personal** account: the buyer you log in as when approving payments.

Keep them separate: the buyer cannot pay the business account they are logged into. The dashboard shows each account's email and lets you view or reset its password.

**3. Create a REST app** under **Apps & Credentials** (Sandbox), linked to your Sandbox **Business** account. Copy its **Client ID** and **Secret**.

**4. Configure `.env`:**

```dotenv
NEXT_PUBLIC_PAYPAL_CLIENT_ID="YOUR_PAYPAL_SANDBOX_CLIENT_ID"
PAYPAL_CLIENT_SECRET="YOUR_PAYPAL_SANDBOX_CLIENT_SECRET"
PAYPAL_PAYEE_EMAIL="YOUR_SANDBOX_BUSINESS_ACCOUNT_EMAIL@example.com"
```

`PAYPAL_PAYEE_EMAIL` must be the email of the Business account linked to the app. GlobalPay checks that PayPal reports this account as the payee and will not mark a payment completed otherwise.

**5. Test a payment:** in GlobalPay, link the simulated bank, choose a merchant, review and pay. On the PayPal Sandbox page, log in with the **Personal** (buyer) account and approve. GlobalPay captures the payment on the server, confirms it with PayPal and redirects to the dashboard after a few seconds. Try **Cancel and return** on PayPal as well to see the cancelled flow.

Payments run in the merchant's local currency (JPY, GBP, EUR, SGD or USD) at a fixed sample amount set by the server.

## Gemini API configuration

The assistant is optional (see [AI functionality](#ai-functionality)).

1. Create an API key in [Google AI Studio](https://aistudio.google.com/).
2. Set it in `.env`:

   ```dotenv
   AI_PROVIDER="gemini"
   AI_API_KEY="YOUR_GEMINI_API_KEY"
   AI_MODEL="gemini-3.5-flash"
   ```

3. Restart `npm run dev`.

Model availability depends on your key and Google's current model line-up. If the assistant reports that the model is not available to your key, set `AI_MODEL` to a model your key can use. You can list them with:

```bash
# macOS / Linux
curl -H "x-goog-api-key: $AI_API_KEY" "https://generativelanguage.googleapis.com/v1beta/models"
```

```powershell
# Windows PowerShell
Invoke-RestMethod -Headers @{ "x-goog-api-key" = $env:AI_API_KEY } "https://generativelanguage.googleapis.com/v1beta/models"
```

(These read the key from your shell environment; set it there first or paste it in place of the variable. Do not commit it.)

## Foreign exchange provider

Exchange rates come from [Frankfurter](https://www.frankfurter.app/), which publishes European Central Bank reference rates and needs **no API key**.

- The server fetches the latest EUR-based rates for INR, JPY, GBP, SGD and USD and derives cross rates between all six currencies.
- Rates are cached for `FX_CACHE_TTL_SECONDS` (default 300 seconds). If Frankfurter is unreachable, cached rates up to twice that age may be shown, marked with their timestamp.
- When a quote is shown at payment review, the transaction stores an immutable snapshot of it.
- Rates are **indicative reference rates**, not the rate PayPal or a card issuer would apply, and not a guaranteed or zero-markup rate.

Frankfurter is the only implemented provider. `FX_PROVIDER` and `FX_API_KEY` exist in the configuration for a future provider but have no effect today.

## Testing

The automated suite uses Node's built-in test runner and covers sessions, preferences, merchants, demo QR codes, FX quotes, transactions, bank linking, the PayPal payment lifecycle (capture, idempotency, concurrency, reconciliation, declines, cancellation) and the Gemini client.

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Before running `npm test`:

- Apply migrations to the database in `DATABASE_URL` (`npm run db:migrate`).
- **The tests write to that database.** They create demo sessions, transactions and audit records, and seed the merchant catalogue. They do not delete data, but use a development database you do not mind filling with test rows, never a shared or production one.
- PayPal, Gemini and Frankfurter calls are mocked in the tests; no real external requests or credentials are needed beyond placeholder PayPal values.

To run the tests against a separate database, set `DATABASE_URL` in the shell for that run (shell variables take precedence over `.env`):

```powershell
# Windows PowerShell
$env:DATABASE_URL = "mysql://globalpay_app:PASSWORD@127.0.0.1:3306/globalpay_test"; npm test
```

```bash
# macOS / Linux
DATABASE_URL="mysql://globalpay_app:PASSWORD@127.0.0.1:3306/globalpay_test" npm test
```

(Create and migrate `globalpay_test` first, the same way as `globalpay_dev`.)

**Manual Sandbox testing** follows the steps in [PayPal Sandbox configuration](#paypal-sandbox-configuration). Also worth checking: a receipt opened from a different browser session returns "not found", and refreshing the return page after a completed payment does not capture again.

## Known limitations

**Not implemented** (some of these appear in the design specifications as plans):

- No real payments: PayPal **Sandbox** only, and PayPal is the only payment method.
- No real bank integration: bank linking is **simulated** with mock data.
- No user accounts: sessions are anonymous and expire after 24 hours by default.
- No camera QR scanning: the Scan page selects from demo QR identifiers.
- No PWA installation or offline mode.
- No deployment configuration or hosted instance.
- No PayPal webhooks: payment status is confirmed by server calls to PayPal and the return-page reconciliation.
- No automatic data clean-up: expired sessions and test transactions remain in the database until removed manually.

**Behavioural limitations:**

- Exchange rates are indicative ECB reference rates, not checkout rates.
- Merchants and their sample amounts are illustrative catalogue data.
- Rate limiting is in-memory, so it resets on restart and is not shared between server instances.
- If PayPal has not given a definitive answer after about 60 seconds of automatic checks, the payment is shown as "under review" until you check again.
- The assistant's answers come from a general-purpose model and may be inaccurate; chat history is not saved and is lost on page reload.

## Privacy and data handling

This section describes what the code does. GlobalPay makes **no** compliance claims (for example GDPR or PCI DSS). It has not been assessed against any standard.

**Stored in GlobalPay's MySQL database:**

- **Sessions:** a SHA-256 hash of the session token (never the raw token), creation, expiry, revocation and last-seen timestamps.
- **Preferences:** home country, display currency and chosen destinations.
- **Simulated bank connection:** status, demo institution name, masked account number, account type and a mock mandate reference. No real bank details.
- **Transactions:** merchant, amount and currency, indicative rate and estimated home-currency amount, quote snapshot, status, timestamps and failure codes.
- **Payment attempts:** PayPal order and capture IDs, PayPal status, timestamps and reconciliation flags. No card numbers, PayPal login details or buyer identity are stored.
- **Idempotency records:** hashed idempotency keys, a request fingerprint and a safe copy of the result.
- **Audit events:** payment status changes with sanitised metadata.
- **Merchant catalogue and FX quotes:** demo data and cached rates.

**Not stored:** names, email addresses (other than the configured Sandbox payee email, which lives in `.env`), passwords, card numbers, real bank credentials or assistant chat messages. Client IP addresses are used only in memory to rate-limit session creation.

**Browser:** an HttpOnly session cookie (`gp_session` by default). The assistant conversation is kept in page memory only.

**Sent to third parties:**

| Provider | What GlobalPay sends | Notes |
|---|---|---|
| **PayPal (Sandbox)** | Client credentials (server-to-server), order amount and currency, a description naming the merchant ("GlobalPay Demo Payment to …"), the transaction ID as a reference, and return/cancel URLs | The buyer signs in on PayPal's own pages; GlobalPay never sees their PayPal credentials. PayPal's own policies apply to data the buyer gives PayPal. |
| **Google Gemini** | The assistant conversation (up to 12 recent messages), a fixed system instruction and the API key | Only when a chat message is sent and `AI_API_KEY` is set. No account, transaction or session data is included. How Google handles API data depends on your Gemini API terms and tier. Do not type personal or sensitive information into the chat. |
| **Frankfurter** | A request for the latest EUR rates for the supported currencies | No user data is included. |

**Logs:** server logs are structured and pass through a redaction step for credentials, bearer tokens and database URLs. Assistant logs record the model, HTTP status and timing, not message content.

**Retention:** there is no automatic deletion. Data remains in the database until an operator removes it.

## Security considerations

Implemented safeguards:

- **Server-trusted amounts and status:** clients cannot set the amount, currency or payment status. A transaction is completed only after PayPal confirms a capture whose order ID, amount, currency and payee match.
- **Idempotency and concurrency control:** hashed, session-scoped idempotency keys; a database capture lease per payment attempt; a stable `PayPal-Request-Id` for provider-side idempotency. Duplicate or concurrent requests cannot capture twice.
- **Fail-safe reconciliation:** timeouts and ambiguous provider errors become `STATUS_UNKNOWN` and are reconciled against PayPal; a payment is marked failed only when PayPal reports a definitive decline and holds no capture, and never cancelled after a capture.
- **Session ownership:** every transaction, receipt and payment route checks that the record belongs to the caller's session; other sessions get "not found".
- **Session tokens:** 256-bit random tokens, stored hashed, in HttpOnly, SameSite=Lax cookies (Secure in production).
- **CSRF protection:** state-changing API requests must come from the same origin.
- **Input validation:** Zod schemas on API inputs, including size limits on assistant messages.
- **Rate limits:** on session creation and the assistant endpoint (in-memory).
- **Secret isolation:** PayPal, Gemini and database credentials are read only in server-only modules and are not exposed to the browser bundle.
- **AI containment:** the assistant has no tools, no data access and a restrictive system instruction; provider error details are not passed to the browser.

Before any real-world use you would need, at minimum: production PayPal review, persistent and shared rate limiting, data retention and deletion, HTTPS deployment hardening, monitoring, a dependency upgrade review (`npm audit` currently reports advisories in `prisma` and `zod` that require major-version upgrades) and an independent security assessment.

Please report security issues privately to the repository owner rather than in a public issue.

## Licence

GlobalPay is released under the [MIT License](LICENSE). Copyright (c) 2026 K. Sree Darshini.
