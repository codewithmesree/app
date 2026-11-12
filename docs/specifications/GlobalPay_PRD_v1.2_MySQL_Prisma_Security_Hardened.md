# GlobalPay --- Product Requirements Document (PRD)

**Version:** 1.2\
**Status:** MVP planning — MySQL + Prisma selected\
**Product type:** Mobile-first Progressive Web App (PWA)\
**Hackathon:** PayPal AI Hackathon 2026\
**Target submission deadline:** November 12, 2026\
**Team:** Solo developer

------------------------------------------------------------------------

## 1. Product Overview

### 1.1 Product vision

GlobalPay aims to make international payments easier to understand and
navigate by helping travellers discover available payment options,
understand currency conversion costs, and complete supported digital
payments through a simple, AI-assisted interface.

The long-term vision is to make paying abroad feel as familiar and
transparent as paying at home, regardless of the traveller's country or
preferred payment method.

### 1.2 Problem statement

International travellers encounter fragmented payment experiences when
travelling between countries. Depending on the destination and merchant,
they may need to use cash, cards, digital wallets or local instant
payment systems.

Common pain points include:

-   Uncertainty about which payment methods a merchant accepts.
-   Difficulty understanding exchange rates, conversion fees and the
    final amount charged.
-   Inconsistent payment experiences across countries.
-   Confusion about unfamiliar payment flows and transaction statuses.
-   Difficulty accessing clear explanations when a payment fails or a
    refund is delayed.

Existing payment networks and cross-border services address parts of
this problem. GlobalPay aims to improve the traveller's experience
through intelligent payment guidance and transparent cost information.

### 1.3 Proposed solution

GlobalPay is a mobile-first PWA that combines:

1.  A simplified international payment interface.
2.  Currency conversion and fee transparency.
3.  An AI-powered travel payment assistant.
4.  A supported PayPal checkout flow.
5.  A transaction history and receipt view.

The MVP will demonstrate these capabilities using selected merchant
scenarios and simulated payment-method availability across multiple
countries. PayPal Sandbox will be used for test payments.

**Important scope boundary:** The MVP will not independently connect
every country's banking infrastructure or make every local QR payment
universally interoperable. It will demonstrate a credible
payment-assistance experience using available integrations and clearly
labelled demo scenarios.

------------------------------------------------------------------------

## 2. Target Users

### Primary persona: International traveller

**Profile:** A traveller visiting a foreign country who wants to make
everyday purchases without struggling to understand local payment
systems.

**Goals:** - Understand the price in their home currency. - Know the
payment methods available for a purchase. - Avoid unexpected conversion
costs. - Complete supported payments confidently. - Access receipts and
understand transaction status.

**Pain points:** - Unfamiliar payment interfaces. - Unclear conversion
rates and fees. - Uncertainty about whether a payment method will
work. - Difficulty understanding payment errors.

### Secondary persona: Digital-first traveller

**Profile:** A frequent traveller who already uses digital wallets and
prefers managing expenses digitally.

**Goals:** - Compare payment costs quickly. - Review past
transactions. - Get fast answers about payment options and expenses. -
Minimise unnecessary payment friction.

### Future persona: International merchant

A merchant seeking to communicate accepted payment methods and provide a
smoother checkout experience to international customers. Merchant
onboarding and payment acceptance infrastructure are outside the initial
MVP.

------------------------------------------------------------------------

## 3. Product Goals and Non-Goals

### 3.1 Goals

-   Help travellers understand payment options for selected
    destinations.
-   Show indicative currency conversions and clearly disclose applicable
    fees.
-   Use AI to explain payment choices and answer transaction-related
    questions.
-   Demonstrate a functioning PayPal Sandbox checkout.
-   Deliver a polished, responsive and installable mobile-first
    experience.
-   Demonstrate a clear, secure and user-controlled payment journey.

### 3.2 Non-goals for the MVP

-   Building a new global payment network.
-   Direct bank-to-bank settlement across multiple countries.
-   Supporting every local QR payment standard.
-   Holding user funds or operating as a digital wallet.
-   Processing real-money international payments.
-   Issuing cards or supporting cryptocurrency and stablecoin transfers.
-   Providing guaranteed exchange rates without a provider-backed quote.
-   Building a merchant dashboard or a full-scale financial compliance
    system.

------------------------------------------------------------------------

## 4. Core User Journey

1.  **Open GlobalPay:** The traveller opens the PWA on their phone.
2.  **Set preferences:** The traveller selects their home currency and
    destination country.
3.  **Select a merchant:** The traveller scans a supported demo QR code
    or selects a sample merchant.
4.  **Review the price:** GlobalPay displays the local price, indicative
    home-currency equivalent, rate timestamp and any applicable fees.
5.  **Explore payment options:** The app shows payment methods supported
    by the selected demo scenario.
6.  **Ask the AI assistant:** The traveller can ask questions about
    fees, payment methods or the displayed conversion.
7.  **Confirm checkout:** The traveller proceeds to PayPal Sandbox,
    reviews the checkout and explicitly approves the test payment.
8.  **View the result:** GlobalPay displays the confirmed sandbox
    transaction status and receipt details.
9.  **Review history:** The traveller can revisit the transaction in
    their demo transaction history.

The UI must distinguish between an indicative conversion estimate, a
payment awaiting confirmation and a completed transaction.

------------------------------------------------------------------------

## 5. Functional Requirements

### FR-01: Mobile-first interface

**Priority:** P0 --- Must have

-   Provide responsive layouts for mobile and desktop.
-   Use clear navigation, readable typography and accessible touch
    targets.
-   Present the main actions prominently: destination selection,
    currency conversion, payment options and AI assistance.
-   Support an installable PWA experience on compatible browsers.
-   Provide an appropriate loading, empty and error state for each main
    screen.

**Acceptance criteria:** - Core flows are usable on common mobile screen
sizes. - The application works through a deployed HTTPS URL. - The
interface remains usable on desktop without losing essential
functionality.

### FR-02: Traveller preferences

**Priority:** P0 --- Must have

-   Allow users to select their home currency and destination country.
-   Persist non-sensitive preferences locally where appropriate.
-   Provide sensible defaults and allow users to change their
    selections.

**Acceptance criteria:** - The selected currencies are reflected
throughout the conversion and payment screens. - Invalid or unsupported
currency selections are handled clearly.

### FR-03: Merchant and QR experience

**Priority:** P0 --- Must have

-   Allow the user to select sample merchants across at least three
    destination scenarios.
-   Provide a QR-scanning interface for supported demo QR formats, with
    a manual-selection fallback.
-   Associate each merchant with a country, currency, price and
    configured payment options.
-   Reject unsupported or malformed QR data with a clear explanation.

**Acceptance criteria:** - At least three merchant scenarios can be
demonstrated. - Each scenario loads the correct merchant and price
information. - The app does not claim that arbitrary third-party QR
codes can be paid through GlobalPay.

### FR-04: Currency conversion and fee transparency

**Priority:** P0 --- Must have

-   Display the local purchase amount and indicative equivalent in the
    traveller's home currency.
-   Show the exchange rate used and when it was last updated.
-   Display applicable fees when they are known.
-   Distinguish the estimated total from the amount ultimately confirmed
    by the payment provider.
-   Handle unavailable or stale exchange-rate data gracefully.

**Acceptance criteria:** - Conversion arithmetic is performed by
deterministic application code. - AI is not responsible for inventing
exchange rates or calculating authoritative payment totals. - If a fee
is unknown, the UI labels it as unavailable rather than displaying a
fabricated zero fee.

### FR-05: AI payment assistant

**Priority:** P0 --- Must have

The assistant helps users understand payment options and transaction
information.

Capabilities: - Explain displayed currency conversions and known fees. -
Explain which payment options are available for the selected merchant
scenario. - Answer questions about transaction states using actual
application data. - Explain common payment errors using approved
guidance. - Direct users to the appropriate next step when an issue
occurs.

**Acceptance criteria:** - The AI receives structured application data
rather than relying on unsupported assumptions. - The assistant cannot
invent transaction success, refund status, exchange rates or merchant
acceptance. - The assistant does not initiate or approve payments on the
user's behalf. - Unsupported questions receive a clear limitation or
fallback response.

### FR-06: PayPal Sandbox checkout

**Priority:** P0 --- Must have

-   Integrate the PayPal JavaScript SDK and the appropriate Checkout
    APIs.
-   Create orders through a secure server-side integration using trusted
    server-side merchant and price data.
-   Allow users to approve a test checkout through the PayPal-controlled
    approval flow.
-   Capture the order through the server-side flow and validate the
    provider response, expected order, amount and currency.
-   Use idempotency for applicable create/capture operations and safely
    handle retries, timeouts and concurrent requests.
-   Display success, cancellation, pending and failure states
    appropriately.
-   Treat browser callbacks and client-submitted transaction statuses as
    untrusted input.
-   If webhooks are added, verify authenticity and process events
    idempotently.

**Acceptance criteria:** - A complete sandbox payment can be
demonstrated. - PayPal client secrets, AI keys, database credentials and
other private credentials are never exposed in client-side code or
public repository history. - A transaction is marked completed only
after the backend verifies successful capture and confirms the expected
order, amount and currency. - The backend derives the order amount and
currency from trusted merchant/configuration data, not arbitrary
client-submitted values. - Repeated requests, concurrent requests,
retries and callbacks do not incorrectly create duplicate captures or
completed transactions. - Payment state transitions are validated on the
server; the client cannot set a transaction status directly. - Errors do
not expose secrets, stack traces or internal configuration.

### FR-07: Transaction history and receipts

**Priority:** P1 --- Should have

-   Show transactions created by the demo application.
-   Display merchant, local amount, currency, payment status and
    timestamp.
-   Provide a receipt view for completed sandbox payments.
-   Allow users to distinguish test transactions from real payments.

**Acceptance criteria:** - History reflects verified application
transaction records. - Pending, failed and completed transactions are
visibly distinguishable. - No receipt claims that a real-world merchant
received funds when only a sandbox payment occurred.

### FR-08: PWA capabilities

**Priority:** P1 --- Should have

-   Include a web app manifest, app icons and standalone display
    configuration.
-   Support installation where the browser permits it.
-   Cache selected static resources for a better repeat-visit
    experience.
-   Display a clear offline message when payment functionality is
    unavailable.

**Acceptance criteria:** - The application can be installed on
compatible devices. - Cached content does not imply that live payment
processing or exchange-rate retrieval works offline. - Checkout requires
an active connection.

### FR-09: Security and privacy

**Priority:** P0 --- Must have

-   Use HTTPS for deployment.
-   Store secrets in server-side environment variables.
-   Validate and bound all user input at the server boundary, including
    request body size, type, format and allowed values.
-   Apply server-side authorization checks to every sensitive operation
    and every transaction lookup.
-   Verify PayPal responses before updating transaction status; never
    trust client-submitted success states.
-   Derive payment amount, currency and merchant configuration from
    trusted server-side records.
-   Use idempotency for payment operations where supported and prevent
    unsafe concurrent state transitions.
-   Keep PayPal client secrets, AI provider keys, database credentials
    and session secrets server-side; never expose them through
    `NEXT_PUBLIC_*` variables.
-   Keep `.env*` files and credentials out of Git; provide an
    `.env.example` with placeholders only.
-   Avoid storing card details or other payment credentials.
-   Minimise personal data collection and redact secrets and sensitive
    data from logs.
-   Apply rate limits to payment and AI endpoints; set timeouts and
    resource limits for external APIs.
-   Treat QR payloads, merchant content, user prompts and third-party
    API responses as untrusted input.
-   Use parameterized database queries and safe rendering; avoid unsafe
    HTML injection.
-   Use HTTPS, secure deployment settings and least-privilege
    credentials.
-   Clearly identify the app as a hackathon demo using test payments.

**Acceptance criteria:** - No private API keys or payment secrets appear
in the public repository or client bundle. - A repository secret scan
and dependency audit are completed before submission. - The backend does
not trust client-submitted claims of successful payment, amount,
currency or transaction status. - Sensitive endpoints validate inputs
and enforce the relevant authorization and rate limits. - QR payloads
are schema-validated and cannot cause arbitrary URLs to be fetched or
automatically opened. - Errors do not reveal credentials, stack traces
or internal configuration. - A security test checklist is completed for
payment retries, forged status requests, invalid QR payloads and AI
prompt injection.

------------------------------------------------------------------------

## 6. Key Screens

### Screen 1: Welcome and setup

-   GlobalPay branding.
-   Destination and home-currency selection.
-   Short explanation of supported demo functionality.

### Screen 2: Home

-   Selected destination.
-   Currency conversion summary.
-   Primary action to scan or select a merchant.
-   Access to the AI assistant and transaction history.

### Screen 3: Merchant and payment options

-   Merchant name and country.
-   Purchase amount and local currency.
-   Indicative converted amount.
-   Exchange-rate timestamp and known fee breakdown.
-   Available demo payment options.

### Screen 4: AI assistant

-   Conversational interface.
-   Suggested prompts such as "Explain this conversion" and "Which
    payment options are available?"
-   Answers grounded in current app data.

### Screen 5: Checkout

-   Purchase summary.
-   PayPal Sandbox checkout.
-   Explicit user approval.
-   Clear cancellation and error handling.

### Screen 6: Confirmation and receipt

-   Verified transaction result.
-   Merchant and amount details.
-   Test-payment indicator.
-   Receipt and transaction-history access.

------------------------------------------------------------------------

## 7. Technical Architecture

### Frontend

-   Next.js
-   React
-   TypeScript
-   Tailwind CSS
-   PWA manifest and service worker

### Backend

-   Next.js server-side route handlers or API routes.
-   Server-side PayPal order creation and capture.
-   Validation and transaction-state management.

### Payments

-   PayPal JavaScript SDK.
-   PayPal Checkout APIs.
-   PayPal Sandbox credentials for development and judging.

### AI

-   An LLM API supporting structured tool calls.
-   Application tools for conversion explanations, supported
    payment-option lookup and transaction-status lookup.
-   Server-side validation and clear restrictions on what the assistant
    can do.

### Currency data

-   A currency-rate provider with a documented API.
-   A consistent rate timestamp and fallback behaviour.
-   Indicative rates clearly separated from the final provider-confirmed
    payment amount.

### Data storage

-   **MySQL using the InnoDB storage engine**, accessed through **Prisma ORM**.
-   Keep database access server-side; never connect to MySQL directly from the browser.
-   Store merchant fixtures, transaction records, provider order/capture references, statuses and timestamps.
-   Use schema migrations committed to version control; do not rely on manual production schema edits.
-   Use `DECIMAL`/Prisma `Decimal` for monetary values, never binary floating-point types for persisted money.
-   Enforce primary keys, foreign keys, unique constraints and appropriate indexes in the database.
-   Avoid storing card details, PayPal access tokens, API secrets or other payment credentials.
-   Use a dedicated least-privilege database user for the application and TLS-protected connections where supported by the deployment.

### Deployment

-   Vercel or another HTTPS-capable hosting platform.
-   Environment variables for server-side credentials.
-   Public source repository with an open-source licence for hackathon
    submission.

------------------------------------------------------------------------

### 7.1 Implementation decision: MySQL + Prisma

The MVP database choice is fixed as **MySQL (InnoDB) + Prisma ORM**. Do not leave PostgreSQL as an alternative in implementation prompts or setup documentation. The Prisma schema and migrations must represent the entities in Section 8 and the constraints in Section 17.2.1. The app must access the database only from server-side code.

Suggested server-only environment variable: `DATABASE_URL`. Put only a placeholder in `.env.example`; never commit a real connection string. The exact provider and deployment host may be selected during setup, but it must support the chosen MySQL version, secure connections and Prisma migrations.

------------------------------------------------------------------------

## 8. Data Model --- MVP

### Merchant

-   `id`
-   `name`
-   `country_code`
-   `currency_code`
-   `demo_qr_identifier`
-   `supported_payment_methods`

### Transaction

-   `id`
-   `merchant_id`
-   `local_amount`
-   `local_currency`
-   `home_currency`
-   `indicative_exchange_rate`
-   `estimated_home_amount`
-   `fee_breakdown`
-   `paypal_order_id`
-   `paypal_capture_id` (unique when present; provider identifiers must be verified server-side)
-   `idempotency_key` or equivalent operation key, unique within the relevant operation scope
-   `status`
-   `created_at`
-   `updated_at`

### User preferences

-   `home_currency`
-   `destination_country`

The MVP can use local preferences without requiring account
registration. If user accounts are introduced later, access controls and
data retention must be designed before storing personal transaction
history.

------------------------------------------------------------------------

## 9. AI Behaviour and Guardrails

The AI is an explanatory assistant, not a payment processor or financial
authority.

It must: - Use application-provided values for currency, fees and
transaction status. - Explain whether a value is indicative or
provider-confirmed. - State when payment-method availability is
unknown. - Never claim a transaction succeeded until the backend
confirms it. - Never approve or capture payments independently of the
authorised payment flow. - Avoid collecting unnecessary personal or
financial information. - Provide clear guidance when a payment fails or
remains pending.

Financial calculations, payment verification and permission checks must
be implemented in deterministic backend code.

------------------------------------------------------------------------

## 10. Success Metrics

The hackathon MVP will be evaluated using demonstrable product outcomes
rather than unsupported claims of business traction.

### Functional metrics

-   At least three destination/merchant demo scenarios work.
-   Currency conversion and fee explanations display consistently.
-   At least one end-to-end PayPal Sandbox checkout succeeds.
-   Failed, cancelled and pending checkout states are handled.
-   Transaction history accurately reflects backend records.
-   The AI answers a defined set of payment questions using application
    data.

### Usability metrics

-   A first-time tester can navigate from merchant selection to sandbox
    checkout without developer assistance.
-   Users can identify the local amount, indicative home-currency amount
    and applicable fees.
-   Testers understand that sandbox transactions are not real payments.

### Submission readiness

-   The deployed application is accessible.
-   The public repository includes a suitable licence and setup
    instructions.
-   A short demo video shows the main user journey.
-   The submission clearly explains the AI functionality, PayPal
    integration and product limitations.

------------------------------------------------------------------------

## 11. MVP Prioritisation

### P0 --- Required for the demo

-   Mobile-first responsive UI.
-   Destination and currency selection.
-   Three merchant demo scenarios.
-   Indicative currency conversion.
-   AI payment assistant.
-   PayPal Sandbox checkout.
-   Verified transaction status.
-   Basic security and error handling.

### P1 --- Add if time permits

-   Installable PWA experience.
-   QR scanning with a supported-format fallback.
-   Transaction history and receipt screen.
-   Improved loading, empty and error states.
-   Accessibility and usability testing.

### P2 --- Future roadmap

-   Additional country and local payment-system integrations.
-   Real-time merchant acceptance discovery.
-   Multiple payment-provider integrations.
-   User accounts and synchronised transaction history.
-   Merchant onboarding.
-   Real-money payment processing, subject to provider support,
    eligibility, compliance and regulatory requirements.

------------------------------------------------------------------------

## 12. Development Timeline

### October 24--26: Product definition and setup

-   Finalise user journey and wireframes.
-   Create the Next.js project and responsive design system.
-   Configure PayPal Sandbox.
-   Define merchant fixtures and transaction states.

### October 27--31: Core functionality

-   Build merchant selection and conversion screens.
-   Implement currency-rate retrieval and fee display.
-   Complete server-side PayPal order creation and capture.
-   Test checkout success, cancellation and failure.

### November 1--4: AI integration

-   Implement the AI assistant and structured tools.
-   Ground responses in actual application data.
-   Add transaction-status and payment-error guidance.
-   Test hallucination, unsupported questions and payment-state edge
    cases.

### November 5--7: PWA and integration

-   Add manifest and installation support.
-   Improve mobile navigation and QR experience.
-   Connect transaction history and receipts.
-   Run end-to-end tests.

### November 8--10: Polish and deployment

-   Deploy the application.
-   Test on a real phone and desktop.
-   Fix usability and functional issues.
-   Document setup and configuration.

### November 11--12: Submission

-   Record the demo video.
-   Finalise the public repository and licence.
-   Write the hackathon submission.
-   Verify the working demo and submit before the deadline.

**Scope rule:** If time runs short, prioritise a complete, reliable
PayPal Sandbox checkout and a grounded AI assistant over adding more
countries, complex QR scanning or native-app features.

------------------------------------------------------------------------

## 13. Risks and Mitigations

**Risk: The product appears too similar to existing payment services.**\
Mitigation: Focus on the traveller's decision-making
experience---payment compatibility, cost transparency and AI-assisted
guidance---rather than claiming to invent a universal payment network.

**Risk: The PayPal checkout does not represent a local bank-to-bank
payment.**\
Mitigation: Explain the distinction explicitly and present the
integration as a sandbox checkout demonstration.

**Risk: AI gives incorrect financial information.**\
Mitigation: Use deterministic calculations, structured data and explicit
uncertainty handling.

**Risk: The demo becomes too ambitious for a solo developer.**\
Mitigation: Limit the first release to a few configured merchant
scenarios and one reliable end-to-end checkout.

**Risk: Payment or rate-provider availability changes.**\
Mitigation: Use documented APIs, test credentials, clear fallback states
and non-misleading demo data.

**Risk: The app is mistaken for a production financial service.**\
Mitigation: Label test payments clearly and avoid collecting or handling
real payment credentials.

------------------------------------------------------------------------

## 14. Definition of Done

The GlobalPay MVP is ready for submission when:

-   A traveller can select a destination and home currency.
-   A supported demo merchant can be selected or scanned.
-   The app displays an indicative conversion and known fees.
-   The AI assistant can explain the displayed information accurately.
-   The user can approve and complete a PayPal Sandbox checkout.
-   The backend verifies the result before displaying a completed
    transaction.
-   The transaction can be reviewed in the demo history or receipt
    screen.
-   The mobile experience is polished and the app is deployed.
-   The repository, licence, setup instructions and demo video are
    ready.
-   The submission accurately describes what is simulated and what is
    integrated.

------------------------------------------------------------------------

## 15. Product Positioning

**Product name:** GlobalPay

**Tagline:** *Your world. One smarter way to pay.*

**One-line description:** GlobalPay is an AI-powered travel payment
companion that helps international travellers understand payment
options, compare currency costs and navigate supported digital
checkouts.

**Core differentiator:** A traveller-first intelligence layer that makes
unfamiliar payment options and currency costs easier to understand,
while keeping the actual payment process transparent and
user-controlled.

**Long-term vision:** Explore interoperable payment experiences across
countries and providers, subject to supported integrations, commercial
partnerships and applicable regulations.

------------------------------------------------------------------------

## 16. Reference Documentation

-   PayPal Developer Documentation: https://developer.paypal.com/
-   PayPal Checkout: https://developer.paypal.com/docs/checkout/
-   PayPal Sandbox: https://developer.paypal.com/tools/sandbox/
-   PayPal AI Hackathon: https://paypalaihackathon.devpost.com/
-   MDN Progressive Web Apps:
    https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps
-   Next.js Documentation: https://nextjs.org/docs
-   MySQL Documentation: https://dev.mysql.com/doc/
-   Prisma Documentation: https://www.prisma.io/docs
-   Web App Manifest:
    https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest

*This PRD defines a hackathon prototype, not a production-ready
cross-border payment service. Real-money payment functionality would
require further provider approval, security review, compliance work and
country-specific validation.*

------------------------------------------------------------------------

## 17. Security Addendum --- Required Before Building

This addendum supplements FR-06, FR-09, Sections 7--9, and the
Definition of Done. These are MVP security requirements, not optional
future enhancements.

### 17.1 Security invariants

1.  **Server-authoritative payment status:** No client-submitted value,
    browser callback, redirect parameter or AI response can
    independently mark a transaction completed.
2.  **Trusted amount and currency:** The backend resolves the selected
    merchant, amount and currency from trusted configuration or database
    records. It does not trust a client-supplied total.
3.  **Least privilege:** The AI has read-only, narrowly scoped tools.
    Payment creation, capture, refunds and transaction-state changes
    remain in deterministic backend code.
4.  **Secret isolation:** Private credentials are server-only. Any
    `NEXT_PUBLIC_*` value must be treated as public.
5.  **Fail closed:** Invalid inputs, failed verification, unknown
    merchant IDs, mismatched amounts/currencies and unexpected payment
    states must not produce a successful payment result.
6.  **Safe retries:** Payment operations must be idempotent where
    supported and safe under retries and concurrent requests.
7.  **Minimal data:** Collect and retain only the data needed for the
    demo. Do not store card details or payment credentials.
8.  **Transparent demo status:** All sandbox receipts and confirmations
    clearly state that they are test transactions.

### 17.2 Required payment state model

Use a documented, server-enforced state machine. Suggested states:

-   `CREATED`
-   `APPROVAL_PENDING`
-   `CAPTURE_PENDING`
-   `COMPLETED`
-   `CANCELLED`
-   `FAILED`
-   `UNKNOWN_REQUIRES_RECONCILIATION`

Only valid transitions are permitted. For example, the frontend cannot
change `APPROVAL_PENDING` directly to `COMPLETED`. An ambiguous network
timeout must be reconciled with PayPal before retrying a capture or
presenting a final outcome.

Store provider order and capture references, status, amount, currency,
timestamps and an internal transaction identifier. Do not store access
tokens or secrets in transaction records.

### 17.2.1 MySQL and persistence requirements

- Use MySQL with the InnoDB engine so multi-record updates can use ACID transactions.
- Use Prisma for typed server-side data access and committed schema migrations.
- Wrap related database writes (for example, a verified payment-state update and its history/audit record) in a database transaction. A database transaction does **not** make a PayPal API call atomic with MySQL; design explicit recovery and reconciliation for provider success followed by a database failure.
- Store money as fixed-precision decimal values and define currency codes explicitly. Avoid JavaScript floating-point arithmetic for authoritative monetary calculations; use a decimal-safe approach and documented rounding rules.
- Add unique constraints for PayPal order/capture identifiers where appropriate, and for idempotency keys within their defined scope. Treat unique-constraint conflicts as duplicate/retry signals to handle safely, not as proof of payment.
- Use foreign keys for related records, indexes for common lookup paths, and restrictive nullability/defaults for status and timestamps. Validate allowed state transitions in backend code; a database enum/check constraint may be added where compatible with the chosen MySQL version and migration strategy.
- Use parameterized queries or Prisma's safe query APIs. Avoid raw SQL unless necessary; never interpolate untrusted values into SQL strings.
- Keep connection strings in server-only environment variables. Use a separate least-privilege application database account, encrypted transport where available, and separate development/deployment databases.
- Never log database URLs, credentials, full payment payloads, or sensitive personal data. Backups and retention should match the MVP's minimal-data policy.
- The MySQL record is the application's persistence record, not the payment authority: the backend must verify PayPal state before persisting `COMPLETED`.

### 17.3 QR input rules

-   Define and document the exact supported demo QR schema.
-   Validate payload length, structure, field types and merchant
    identifier.
-   Resolve price, currency and supported payment methods from trusted
    server-side merchant data.
-   Reject malformed or unsupported payloads with a safe error.
-   Do not automatically navigate to URLs found in a QR payload.
-   Do not fetch arbitrary user-supplied URLs from the server.
-   Require a confirmation screen showing merchant, amount and currency
    before checkout.

### 17.4 AI security rules

-   Provide only the minimum structured context needed to answer a
    question.
-   Treat all user messages and external content as untrusted data, not
    privileged instructions.
-   Do not allow model output to determine authoritative financial
    calculations or transaction state.
-   Validate every tool argument on the server.
-   Enforce permissions inside each tool implementation.
-   Do not expose arbitrary database query, arbitrary URL-fetching,
    payment capture or refund tools to the model.
-   Add tests for prompt injection, requests to reveal secrets, false
    success claims and unsupported refund/status claims.
-   Apply rate limits, input-size limits and sensible output limits.

### 17.5 API and application security

-   Validate all server inputs using a schema-validation library or
    equivalent explicit validation.
-   Use parameterized queries or safe ORM APIs.
-   Use safe React rendering; do not render untrusted content as raw
    HTML.
-   Apply rate limits to AI, checkout and other costly or sensitive
    endpoints.
-   Use timeouts and bounded retries for third-party API calls.
-   Restrict CORS to required origins if cross-origin access is needed;
    do not treat CORS as authorization.
-   Apply suitable CSRF/origin protections for the chosen session and
    mutation model.
-   Treat Next.js Route Handlers and Server Actions as externally
    reachable endpoints; validate input and authorize sensitive
    operations.
-   Return generic client errors and redact credentials, tokens, payment
    data and unnecessary personal data from logs.
-   Use supported dependency versions and review dependency
    vulnerabilities before deployment.
-   Keep development, Sandbox and any future production configuration
    separate.

### 17.6 Secrets and repository hygiene

-   Keep `.env.local`, `.env`, private keys and credentials out of
    version control.
-   Include `.env.example` with variable names and placeholder values
    only.
-   Review Git-tracked files and history for accidentally committed
    secrets before publishing.
-   If a real secret is exposed, revoke or rotate it; removing the
    visible file is not sufficient.
-   Use least-privilege provider credentials and separate Sandbox
    credentials from any production credentials.
-   Never paste private keys, access tokens, production data or real
    customer information into an AI coding assistant.

### 17.7 Security acceptance tests

Before public submission, verify that:

-   [ ] A forged client request cannot mark a transaction completed.
-   [ ] Changing a browser-supplied amount or currency does not alter
    the trusted purchase amount.
-   [ ] Unknown or malformed merchant and QR identifiers are rejected.
-   [ ] Double-clicks, concurrent requests and safe retries do not
    create duplicate completed transactions.
-   [ ] A timeout or ambiguous capture response is reconciled instead of
    blindly retried.
-   [ ] Invalid or mismatched PayPal order/capture details cannot create
    a successful receipt.
-   [ ] No private credential is present in the client bundle, tracked
    repository files or logs.
-   [ ] AI prompt injection cannot grant the model payment authority or
    cause it to reveal secrets.
-   [ ] AI responses cannot independently change transaction status or
    invent authoritative conversion data.
-   [ ] Sensitive and costly endpoints enforce appropriate rate limits
    and input-size limits.
-   [ ] Error messages do not expose stack traces, credentials or
    internal configuration.
-   [ ] All demo checkout screens and receipts clearly identify
    Sandbox/test payments.

### 17.8 Security severity and release gates

**P0 --- Block the demo release until fixed:** Exposed secrets;
client-controlled payment status; untrusted amount/currency; failed
PayPal verification; duplicate capture risk; unauthorized transaction
access; AI access to privileged payment tools.

**P1 --- Fix before public deployment:** Missing rate limits on costly
endpoints; unsafe QR handling; unsafe rendering; excessive error
disclosure; vulnerable dependencies; inadequate input validation.

**P2 --- Improve when scope permits:** Additional monitoring, automated
security scanning and expanded negative testing beyond the MVP's
essential cases.

A successful happy-path checkout is not sufficient evidence of security.
Negative tests must demonstrate that invalid requests fail safely.

------------------------------------------------------------------------

## 18. Supporting Documents and Build Artifacts

Create these before or during implementation. Keep them in a `/docs`
folder in the repository.

### Required before coding the payment flow

1.  **Architecture and data-flow diagram** --- Show browser, Next.js
    server, database, PayPal, AI provider and currency provider. Mark
    every trust boundary and show where secrets and authoritative state
    live.
2.  **Threat model** --- List assets, trust boundaries, likely
    attackers, attack scenarios, mitigations and residual risks. Start
    with payment tampering, secret exposure, QR abuse, prompt injection,
    transaction access and resource exhaustion.
3.  **API contract** --- Document each endpoint, accepted request
    fields, validation, authentication/authorization requirements,
    response shape, error cases and rate limits.
4.  **Payment state-machine document** --- Define allowed transaction
    states and transitions, including cancellation, failed capture,
    timeouts, duplicate requests and reconciliation.
5.  **Environment-variable inventory** --- List each variable, what it
    is for, whether it is public or secret, and where it is configured.
    Never include real values. Include the MySQL connection URL as a secret.
6.  **Database schema and migration notes** --- Document the Prisma models, foreign keys, unique constraints, monetary precision, idempotency scope, indexes, migration commands and recovery strategy for provider/database partial failure. Never include real connection strings.
7.  **Security test plan** --- Include positive tests and adversarial
    tests based on Section 17.7.
8.  **AI tool/guardrail specification** --- List each tool, its
    arguments, permitted data, access rules and forbidden actions.

### Required before submission

9.  **README and setup guide** --- Prerequisites, installation,
    environment setup, Sandbox configuration, test commands, deployment
    steps and known limitations.
10. **Test report** --- Unit, integration and end-to-end results,
    including payment failure and security-negative tests.
11. **Dependency and secret scan results** --- Record the checks run and
    resolve critical/high findings that affect the deployed app.
12. **Privacy/data note** --- Explain what data is collected, where it
    is stored, which external providers receive data, retention
    expectations and how to contact the project owner. Do not claim
    compliance certification without evidence.
13. **Demo script and limitations statement** --- Explain what is live,
    what is simulated, how Sandbox works, and which payment methods are
    not actually integrated.
14. **Open-source licence and attribution** --- Include a suitable
    licence and comply with third-party asset/library terms.
15. **Deployment checklist** --- HTTPS, production environment
    variables, Sandbox credentials, error handling, logging, rate limits
    and final smoke test.

------------------------------------------------------------------------

## 19. Recommended Repository Structure

``` text
globalpay/
├── app/
│   ├── (pages)/
│   └── api/
│       ├── checkout/
│       ├── transactions/
│       ├── currency/
│       └── assistant/
├── components/
├── prisma/
│   ├── schema.prisma  # MySQL data model and constraints
│   └── migrations/    # Versioned database migrations
├── lib/
│   ├── paypal/          # Server-only PayPal integration
│   ├── security/        # Validation, authorization, rate limiting
│   ├── ai/              # Prompt, tools and output handling
│   ├── currency/        # Rate retrieval and deterministic calculations
│   └── db/              # Server-only Prisma client and data access
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/
│   ├── architecture.md
│   ├── threat-model.md
│   ├── api-contract.md
│   ├── payment-state-machine.md
│   ├── security-test-plan.md
│   ├── ai-guardrails.md
│   └── privacy-data-note.md
├── .env.example
├── .gitignore
├── README.md
└── LICENSE
```

This is a suggested structure, not a requirement to create every folder
on day one. Keep private payment and database code on the server and
avoid adding abstractions that do not help the MVP.

------------------------------------------------------------------------

## 20. Official Security and Integration References

-   PayPal developer documentation: https://developer.paypal.com/
-   PayPal Checkout: https://developer.paypal.com/docs/checkout/
-   PayPal Sandbox: https://developer.paypal.com/tools/sandbox/
-   PayPal API requests and idempotency:
    https://developer.paypal.com/api/make-api-requests
-   PayPal webhooks: https://developer.paypal.com/api/rest/webhooks/
-   MySQL Reference Manual: https://dev.mysql.com/doc/
-   Prisma ORM documentation: https://www.prisma.io/docs/
-   OWASP API Security Top 10:
    https://api-security.owasp.org/editions/2023/en/0x11-t10/
-   Next.js data security:
    https://nextjs.org/docs/app/guides/data-security
-   Next.js environment variables:
    https://nextjs.org/docs/app/guides/environment-variables

These references are implementation resources; consult the relevant
provider documentation for the exact API flow and requirements you use.
