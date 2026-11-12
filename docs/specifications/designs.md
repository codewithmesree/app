# GlobalPay — Design System & UI Specification

**Document version:** 1.0  
**Status:** Design and implementation guide for the MVP  
**Product:** GlobalPay — AI-assisted international travel payment PWA  
**Hackathon:** PayPal AI Hackathon 2026  
**Related documents:** `GlobalPay_PRD_v1.2_MySQL_Prisma_Security_Hardened.md`, `architecture.md`, `threat-model.md`

> GlobalPay is a hackathon prototype. PayPal Sandbox is used for test payments. The UI must never imply that a Sandbox transaction moved real money or that GlobalPay supports universal QR-payment interoperability.

---

## 1. Design intent

GlobalPay should feel like a premium travel-finance product: calm, confident, modern, and easy to understand under time pressure. The visual language combines a dark, near-black foundation with rich violet accents, soft gradients, restrained glass effects, crisp typography, and clear transaction status.

The interface should communicate three things quickly:

1. **Where am I?** — current page, merchant or transaction context, and selected currency.
2. **What will happen?** — amount, currency, indicative conversion details, and the next action.
3. **What is the actual status?** — especially whether a payment is only prepared, awaiting user approval, pending verification, completed in Sandbox, or failed.

The product should look polished without hiding important financial details behind decorative UI.

### Design principles

- **Clarity before spectacle:** amount, currency, fees/estimates, and status take priority over decoration.
- **Honest financial UX:** label exchange rates as indicative, show their timestamp/source where available, and clearly identify PayPal Sandbox.
- **One primary action per view:** avoid competing primary buttons.
- **Progressive disclosure:** advanced details can be expandable, but key costs and payment status must remain visible.
- **Accessible contrast:** never rely on color alone to communicate success, warning, or failure.
- **Consistent feedback:** every user action has a loading, success, empty, or error response.
- **Mobile-first:** payment and QR flows must work comfortably on narrow screens and with touch input.
- **Reduced motion:** animations are optional enhancements, not required to understand the interface.

---

## 2. Visual direction

### Mood

- Premium fintech dashboard
- International travel and airport-at-night atmosphere
- Dark surfaces with subtle violet illumination
- Minimal, editorial layout with strong numeric hierarchy
- Soft corners and controlled depth; avoid excessive neon, blur, or floating decoration

### Color tokens

Use CSS variables or Tailwind theme tokens so the palette can be adjusted centrally. These are initial design tokens, not a requirement to hard-code colors in every component.

| Token | Suggested value | Usage |
|---|---|---|
| `--gp-bg` | `#09090F` | Main page background |
| `--gp-surface` | `#11111B` | Cards and primary panels |
| `--gp-surface-raised` | `#191927` | Modals, menus, elevated cards |
| `--gp-surface-muted` | `#202033` | Secondary controls and subtle fills |
| `--gp-border` | `#2B2B40` | Dividers and card borders |
| `--gp-text` | `#F5F3FF` | Primary text |
| `--gp-text-muted` | `#A7A5BB` | Secondary text |
| `--gp-text-subtle` | `#77758D` | Tertiary text; verify contrast before use |
| `--gp-primary` | `#8B5CF6` | Primary actions and key highlights |
| `--gp-primary-hover` | `#A78BFA` | Hover/focus treatment where appropriate |
| `--gp-primary-soft` | `#2A2044` | Soft violet backgrounds |
| `--gp-info` | `#60A5FA` | Informational states |
| `--gp-success` | `#34D399` | Verified success |
| `--gp-warning` | `#FBBF24` | Pending, caution, stale quote |
| `--gp-danger` | `#FB7185` | Failure and destructive actions |

**Color rules**
- Use the violet accent for actions and active states, not for every border and label.
- Pair status colors with text labels and an icon or shape.
- Do not show a green success state until the server has verified the PayPal capture.
- Use a subdued warning banner to identify Sandbox mode; it must remain readable.
- Check text and controls against WCAG AA contrast targets. If a token fails, adjust it rather than sacrificing readability.

### Gradients and effects

- Optional hero gradient: deep violet fading into the page background.
- Use glow only behind a hero illustration, active focus, or a small accent element.
- Prefer thin borders and subtle shadows over heavy glassmorphism.
- Use backdrop blur sparingly and never for essential text or financial figures.
- Avoid continuously animated gradients or distracting background particles.

### Typography

Use a clean sans-serif such as **Inter** or a system sans-serif fallback.

| Text role | Guidance |
|---|---|
| Display / hero | 32–48 px desktop; 28–36 px mobile; medium or semibold |
| Page heading | 26–32 px desktop; 24–28 px mobile |
| Section heading | 18–22 px, semibold |
| Body | 14–16 px, comfortable line-height |
| Label / metadata | 12–14 px; maintain adequate contrast |
| Main amount | 28–40 px depending on context; tabular numerals preferred |
| Button | 14–16 px, medium or semibold |

Use tabular numerals for amounts and exchange-rate values when the selected font supports them. Avoid very light weights for important numbers.

### Shape, spacing, and layout

- Base spacing scale: 4, 8, 12, 16, 24, 32, 40, 48, 64 px.
- Standard card radius: 16–20 px.
- Buttons and inputs: 12–14 px radius.
- Chips and status badges: pill shape.
- Main content max-width: approximately 1200 px for dashboard pages.
- Keep text blocks narrower than full card width where this improves readability.
- Use a consistent 12-column desktop grid only when it adds value; do not force every page into a dense dashboard layout.

---

## 3. Application shell and navigation

### Desktop shell

- **Left sidebar:** GlobalPay logo, Overview, Pay / Scan, Transactions, Merchants, AI Assistant, Settings (if settings are implemented).
- **Top bar:** page title or breadcrumb, optional search, Sandbox indicator, and profile/session control if authentication/session identity exists.
- **Main content:** page-specific content within a consistent max-width.
- Keep the sidebar stable between core pages. Highlight the current destination with a soft violet surface and a clear text/icon state.

### Mobile shell

- Use a compact top bar with GlobalPay wordmark and a visible Sandbox badge.
- Use a bottom navigation bar for the most important destinations: Home, Pay, Activity, Assistant.
- Do not make critical actions available only through hover.
- On narrow screens, stack cards vertically and place the main action within easy thumb reach.
- Keep safe-area insets in mind for bottom navigation and sticky action bars.

### Navigation behavior

- Current page must be identifiable through both color and a label/shape change.
- Preserve context when moving from a merchant to a payment preview and from a transaction to its detail page.
- Warn before leaving a payment flow if doing so could interrupt the user's understanding of its status; do not claim that leaving cancels a provider-side operation unless the server confirms that behavior.

---

## 4. Core screens

The screen list below defines intended MVP behavior. Any feature not implemented must be omitted or clearly marked as unavailable; do not ship decorative controls that pretend to work.

### 4.1 Welcome / onboarding

**Goal:** Explain the prototype in seconds and get the user into the demo.

**Content**
- GlobalPay wordmark and concise value proposition.
- One sentence explaining supported demo scenarios.
- A prominent “Explore demo” or “Continue” action.
- A visible note that payments use PayPal Sandbox and do not move real money.
- Optional compact feature cards: view indicative currency quotes, explore demo merchants, and review test transactions.

**Avoid**
- Claims of universal international acceptance.
- Claims that real exchange rates or guaranteed final amounts are available unless the provider and data freshness support them.
- Requiring lengthy onboarding for a hackathon demonstration.

### 4.2 Overview dashboard

**Goal:** Provide a useful snapshot and clear next actions.

**Suggested hierarchy**
1. Greeting or page title and a short “Ready for your next trip?” message.
2. Primary action card: “Pay a merchant” / “Scan a demo QR”.
3. Currency quote card showing base amount, converted estimate, rate timestamp, and an “Indicative rate” label.
4. Recent transactions list with status labels.
5. Quick links to merchants and the AI Assistant.

**States**
- First visit: show a helpful empty state, not fabricated activity.
- Loading: use skeletons that resemble the final layout.
- Quote unavailable: explain that the rate could not be refreshed and avoid showing it as current.
- No recent transactions: show a concise prompt to explore the demo.

**Data integrity:** dashboard values must come from API responses. Do not hard-code a successful payment or use static mock transactions in a way that could be mistaken for a real user's activity.

### 4.3 Merchant discovery and merchant detail

**Goal:** Let the user understand the merchant and what the demo supports before starting a payment.

**Merchant card**
- Merchant name and category.
- City/country only if known and part of the demo data.
- Supported demo payment method(s).
- Clear “View details” or “Pay” action.
- Optional category icon or illustration.

**Merchant detail**
- Merchant name and concise description.
- Display currency and any configured payment constraints.
- Supported flow: PayPal Sandbox checkout, or QR demo if actually implemented.
- Amount entry or amount selection.
- Clear disclosure of indicative conversion information and any unavailable fees.
- Primary CTA: “Review payment”.

Do not display fake star ratings, verified badges, logos, or location claims unless the data is real or clearly presented as sample/demo content.

### 4.4 Payment preview / confirmation

**Goal:** Let the user verify the exact intended demo transaction before leaving for provider approval.

This is the highest-priority screen for clarity.

**Required information**
- Merchant name.
- Amount and currency the user is paying.
- Any conversion estimate, with rate timestamp and source when available.
- Any known fee or an explicit statement that fees/final conversion may be determined by the provider and are not guaranteed by this estimate.
- Sandbox/test-payment notice.
- A concise summary of what happens next.
- Primary action to continue to PayPal Sandbox checkout.
- Secondary action to go back and edit.

**Interaction**
1. Validate the amount and merchant selection.
2. Request a server-created transaction/quote.
3. Render the server's response; do not trust a client-calculated total as authoritative.
4. Let the user review the information.
5. On continuation, call the server payment-create endpoint using the internal transaction ID.
6. Show a waiting state while the provider flow is being prepared.

**Important:** do not make the payment appear complete just because the user clicks a button or returns from PayPal. Completion is shown only after server-side capture verification.

### 4.5 PayPal Sandbox checkout handoff

**Goal:** Make the provider handoff understandable.

- Clearly identify the next step as PayPal Sandbox/test checkout.
- Disable duplicate submit actions while a request is in progress.
- Provide a retry path for safe, recoverable failures.
- If the browser is redirected or a provider popup is opened, preserve the internal transaction reference without putting secrets in the URL.
- If the user closes the provider flow, show “Approval not completed” or “Status not yet confirmed” as appropriate—not “Payment failed” unless the server knows it failed.
- Do not show a successful state based only on a client-side return URL or SDK callback.

### 4.6 Payment result

Use separate, explicit states rather than one generic result page.

| State | Suggested label | Visual treatment | User guidance |
|---|---|---|---|
| Awaiting approval | “Waiting for PayPal approval” | Neutral / info | Complete or return from the Sandbox checkout |
| Processing / verification | “Verifying test payment” | Info with restrained progress | Keep this page open briefly; status will be checked by the server |
| Completed | “Sandbox payment completed” | Success | Show the verified amount, currency, merchant, and transaction reference |
| Approval cancelled | “Approval not completed” | Neutral | Return to payment preview or retry if safe |
| Failed | “Payment could not be completed” | Error | Explain the safe next step; avoid raw provider errors |
| Unknown / delayed | “Status not confirmed yet” | Warning | Refresh status or check activity; do not create a duplicate transaction |
| Expired / abandoned | “Payment session expired” | Neutral | Start a new attempt if the server allows it |

For a successful Sandbox capture, display a persistent “Test payment — no real money moved” label. Use success animation sparingly and only after the server confirms completion.

### 4.7 Transactions / activity

**Goal:** Help users understand previous demo attempts.

- List merchant, date/time, amount/currency, and explicit status.
- Use stable status wording consistent with the payment result screen.
- Provide filtering only if it can be implemented reliably; otherwise keep the list simple.
- Show a transaction detail view with internal reference and provider reference where safe.
- Do not display full secrets, access tokens, payment credentials, or unnecessary personal information.
- Do not expose another user's transactions; the backend must enforce ownership.

**Empty state:** “Your activity will appear here after you try a demo payment.”

### 4.8 QR scan / QR preview (only if included in the MVP)

**Goal:** Make QR-based demo interactions safe and understandable.

- Request camera permission only after the user selects scan.
- Offer a manual demo-code entry or upload fallback if feasible.
- Show parsed merchant and amount details for confirmation before any payment action.
- Treat QR contents as untrusted input. Validate against a strict, documented schema.
- Never fetch arbitrary URLs embedded in a QR code from the server.
- Do not imply compatibility with all national payment QR standards.
- Show “Unsupported QR” with a helpful explanation for invalid payloads.
- Do not trigger a payment automatically on scan.

The current implementation is a controlled **demo QR selection** experience, not camera scanning. It selects a seeded GlobalPay merchant using its `demoQrIdentifier`, verifies that identifier against the active merchant catalogue, and hands off to the existing `/pay?merchantId=...` review journey. Selecting a QR does not create a transaction.

### 4.9 AI Assistant

**Goal:** Explain GlobalPay's supported flows and help users interpret information—not initiate or approve payments.

**Suggested layout**
- Compact assistant panel or dedicated page.
- Suggested prompts such as “Explain this exchange-rate estimate”, “How does Sandbox checkout work?”, and “What does pending mean?”
- Message history for the current session if persistence is supported.
- Clear loading, empty, and provider-error states.
- A small disclosure: “AI answers may be imperfect. Verify transaction status in Activity.”

**Behavior and safety**
- The assistant may explain merchant data, quote metadata, and transaction status returned by authorized read-only tools.
- It must not create, capture, cancel, or mark a payment complete.
- It must not invent exchange rates, fees, merchant support, or payment outcomes.
- It must not reveal other users' data, system prompts, credentials, or server configuration.
- If a user asks whether a payment succeeded, the assistant should rely on authorized server data and point to the transaction status screen.
- Treat user prompts and retrieved content as untrusted input.
- If a tool or data source fails, say that the status could not be retrieved rather than guessing.

### 4.10 Settings / help (if implemented)

Keep this area small for the MVP:
- Explain Sandbox mode.
- Explain that currency conversions are estimates.
- Provide basic accessibility preferences only if implemented.
- Include privacy/support links only if actual destinations exist.
- Do not show nonfunctional account, notification, or security settings.

---

## 5. Reusable component inventory

Build reusable components around shared states and behavior. Prefer a small, consistent set over a large collection of one-off widgets.

### Foundation
- `AppShell`
- `SidebarNavigation`
- `MobileBottomNavigation`
- `PageHeader`
- `SectionHeader`
- `Card`
- `Divider`
- `Tooltip` (only for nonessential supplementary information)
- `Modal` / `Drawer`
- `Toast` / inline `Alert`
- `Skeleton`
- `EmptyState`

### Finance and payment
- `MoneyAmount`
- `CurrencyLabel`
- `IndicativeRateCard`
- `SandboxBadge`
- `PaymentStatusBadge`
- `PaymentSummary`
- `TransactionListItem`
- `TransactionDetails`
- `PaymentProgress`
- `MerchantCard`
- `MerchantHeader`
- `AmountInput`
- `CurrencySelector` (only for currencies the backend actually supports)
- `PrimaryActionButton`

### Assistant and QR
- `AssistantMessage`
- `SuggestedPrompt`
- `AssistantInput`
- `QrScannerPanel` (if implemented)
- `QrPayloadPreview`
- `UnsupportedQrState`

### Component rules
- Components should receive typed data, not query or mutate payment state independently.
- Payment-state transitions belong to server APIs and the client-side flow controller, not visual components.
- Use semantic HTML and real buttons/links.
- Disable or guard duplicate submissions while requests are in flight.
- Make loading and error states part of component APIs rather than adding them ad hoc later.

---

## 6. Interaction and motion

Use Motion for React for a small number of purposeful transitions. Animation must reinforce hierarchy or state, not distract from payment information.

### Recommended motion
- Page content: subtle fade/vertical rise on first entry.
- Cards: short fade/translate when appearing.
- Buttons: small press-scale or color transition.
- Dialogs/drawers: short opacity and position transition.
- Payment progress: restrained spinner or step indicator.
- Verified completion: one brief checkmark reveal after server verification.
- Charts: animate line drawing only when it does not delay reading or imply fabricated live data.

### Timing guidance
- Micro-interactions: approximately 120–180 ms.
- Dialog/page transitions: approximately 180–260 ms.
- Avoid long entrance sequences and chained animations.
- Do not animate amounts in a way that could make the value ambiguous.
- Do not use a celebratory success animation before verified server state.

### Reduced motion
- Respect `prefers-reduced-motion`.
- Disable nonessential movement and chart animations when reduced motion is requested.
- Preserve all status information when animation is disabled.

### Interaction feedback
- Buttons need hover, focus-visible, pressed, disabled, and loading states.
- Form fields need default, focused, invalid, and disabled states.
- Alerts must remain visible long enough to read; critical errors should not disappear as toasts.
- Use inline errors near the affected field and a summary for longer forms.

---

## 7. Forms, amounts, currencies, and financial copy

### Amount entry
- Use a numeric input appropriate to the device, but validate on the server as well.
- Display currency code alongside the amount; do not rely on a symbol alone.
- Avoid silently rounding user-entered values.
- Apply explicit minimum/maximum and decimal-place rules based on the selected currency and backend contract.
- Show validation errors in plain language.
- Do not accept negative, non-finite, or out-of-range amounts.

### Currency conversion
Every estimate should identify:
- Base amount and currency.
- Converted estimate and currency.
- Exchange rate.
- Provider/source and retrieval time, when available.
- A label such as “Indicative estimate”.
- A note that the final amount may differ and that the estimate is not a guaranteed settlement rate.

If the rate is stale or unavailable, make that state explicit. Never silently reuse a stale quote as though it were current.

### Suggested product copy

Use concise, factual wording. Examples:

- **Sandbox notice:** “Demo mode: PayPal Sandbox is used. No real money will move.”
- **Rate label:** “Indicative exchange rate”
- **Rate disclaimer:** “This is an estimate, not a guaranteed final conversion rate.”
- **Pending state:** “We’re checking the payment status with PayPal.”
- **Unknown state:** “We couldn’t confirm the status yet. Check Activity before trying again.”
- **Success state:** “Sandbox payment completed” / “Test payment only — no real money moved.”
- **Unsupported QR:** “This QR format isn’t supported in the demo.”
- **Assistant limitation:** “I can explain payment information, but I can’t approve or complete a payment for you.”

Avoid copy such as “Guaranteed best rate”, “Instant global acceptance”, “Payment successful” before verified capture, or “Your money is safe” without a defensible basis.

---

## 8. Data visualization

Use charts only where they help users understand supported data.

- Keep charts secondary to the amount and currency labels.
- Include accessible labels or a small text summary of the data.
- Label the time range and currency.
- Show the data source and timestamp where available.
- Include empty, loading, and unavailable states.
- Do not fabricate historical rates, trend lines, savings, or “money saved” metrics.
- If the app only has a single current quote, do not render a fake historical chart.
- Tooltips should not be the only way to access important values.

---

## 9. Responsive behavior

### Breakpoints (suggested)
Use the project's Tailwind breakpoints unless the design review finds a specific reason to change them.

- Mobile: under 640 px
- Small tablet: 640–767 px
- Tablet / compact desktop: 768–1023 px
- Desktop: 1024 px and above
- Wide desktop: 1280 px and above

### Layout rules
- One-column content on mobile.
- Two-column layouts only when each column remains readable.
- On mobile, payment summary should appear before the primary CTA.
- Use sticky action bars only if they do not obscure validation messages or disclosures.
- Tables should become stacked list items or allow deliberate horizontal scrolling; do not squeeze critical amount/status columns until unreadable.
- Use `min-width: 0`, wrapping, and truncation carefully so merchant names and transaction references do not break the layout.
- Camera/QR experiences need a clear exit and manual fallback where feasible.

---

## 10. Accessibility requirements

Target WCAG 2.2 AA practices for the implemented UI.

- Full keyboard navigation for navigation, dialogs, forms, menus, and payment steps.
- Visible focus indicators.
- Semantic headings and landmarks.
- Correct labels and descriptions for inputs.
- Error messages programmatically associated with fields.
- Accessible names for icon-only controls.
- Dialog focus management and Escape behavior where appropriate.
- Status updates announced to assistive technology without excessively repeating content.
- Do not communicate status by color alone.
- Support zoom/reflow at narrow widths.
- Maintain readable contrast for muted text, placeholders, badges, and disabled controls.
- Avoid flashing and respect reduced-motion preferences.
- Provide an accessible alternative to QR scanning where feasible.

---

## 11. UI states and error handling

Every network-backed view should define the following states before implementation is considered complete:

| State | Expected UI |
|---|---|
| Initial | Clear hierarchy and next action |
| Loading | Skeleton or inline progress; prevent duplicate mutation requests |
| Empty | Explain why there is no data and offer a relevant next step |
| Success | Display only after the required server response confirms it |
| Validation error | Field-level message and preserved user input where safe |
| Recoverable error | Explain how to retry safely |
| Permission denied | Explain the unavailable action without exposing internal details |
| Offline | Identify unavailable network-backed actions; do not claim a payment was cancelled |
| Provider timeout | Show “status not confirmed” until reconciliation resolves it |
| Unsupported feature | Say it is not supported in this demo instead of displaying a fake flow |

**Payment-specific rule:** when a create/capture request times out, do not automatically create a second payment attempt. Query the existing transaction's status and use server-side idempotency/reconciliation rules.

---

## 12. Frontend architecture guidance

Suggested component organization (adapt to the existing repository rather than duplicating files):

```text
src/
  app/
    (dashboard)/
      page.tsx
      merchants/
      transactions/
      assistant/
      pay/
    api/
      merchants/
      currency/
      transactions/
      payments/
      assistant/
  components/
    layout/
    ui/
    dashboard/
    merchants/
    payment/
    transactions/
    assistant/
    qr/
  features/
    payment/
      payment-flow-controller.ts
      payment-types.ts
      payment-status.ts
    currency/
    merchants/
    assistant/
  lib/
    api-client.ts
    format-money.ts
    accessibility.ts
```

This is a suggested organization, not a mandate to create empty folders. Keep server-only provider calls and secrets out of client bundles. Do not import database access or PayPal secret configuration into client components.

### State-management guidance
- Use local component state for simple UI interactions.
- Use a focused payment-flow controller/state machine for the multi-step payment journey.
- Treat API responses as the source for transaction state.
- Refresh transaction status from the server after returning from provider checkout.
- Do not use local storage as the authoritative record of payment completion.
- Avoid storing sensitive payment data in browser storage.
- Keep display formatting separate from amount calculation and server validation.

---

## 13. Design acceptance checklist

### Visual quality
- [ ] Dark surfaces, violet accents, typography, spacing, radii, and status colors use shared tokens.
- [ ] Desktop and mobile navigation are consistent and understandable.
- [ ] No card is overcrowded with decorative elements.
- [ ] Amount and currency are the most prominent financial values.
- [ ] The Sandbox notice is visible wherever a payment could be initiated or interpreted.

### Payment clarity
- [ ] Payment preview shows merchant, amount, currency, and estimate disclaimers before handoff.
- [ ] Loading, approval, verification, success, cancellation, failure, and unknown states are distinct.
- [ ] Success appears only after server-side verification.
- [ ] Successful Sandbox state says that no real money moved.
- [ ] Timeout copy tells the user to check Activity rather than blindly retry.
- [ ] No fake fees, rates, merchants, history, or provider outcomes are shown as real data.

### Accessibility and responsiveness
- [ ] Keyboard-only navigation works through core journeys.
- [ ] Focus indicators are visible.
- [ ] Status is conveyed by text and not color alone.
- [ ] Reduced-motion preference is respected.
- [ ] Narrow screens have no horizontal overflow in core flows.
- [ ] Inputs and buttons have comfortable touch targets.
- [ ] QR flow has a safe manual fallback or is explicitly marked as demo-only.

### Engineering consistency
- [ ] UI components do not make authoritative payment-state decisions.
- [ ] API errors are mapped to safe user-facing messages.
- [ ] Duplicate submissions are guarded.
- [ ] Client storage cannot mark a payment completed.
- [ ] Unimplemented controls are removed or clearly disabled.
- [ ] AI assistant is visibly informational and cannot initiate or approve payment actions.

---

## 14. Recommended build order

1. Establish tokens, typography, `AppShell`, navigation, buttons, inputs, cards, badges, alerts, and skeletons.
2. Build responsive dashboard using real API contracts or clearly identified local fixtures.
3. Build merchant list/detail and amount entry.
4. Build payment preview and a typed payment-flow state machine.
5. Implement Sandbox handoff and distinct result states against the server contract.
6. Build transaction history and detail.
7. Add the AI Assistant with read-only server tools.
8. Add QR demo scanning only if time and safe validation permit.
9. Run keyboard, reduced-motion, contrast, mobile-width, empty-state, and payment-failure reviews.
10. Remove any fake success path and all nonfunctional controls before the demo.

---

## 15. Open design decisions

Resolve these during implementation; do not silently imply they already exist:

- Exact logo/wordmark and whether a custom illustration is worth the time.
- Final font choice and whether it is self-hosted.
- Supported currencies and the authoritative source for indicative rates.
- Whether the MVP includes camera QR scanning or only controlled demo QR payloads.
- Whether authentication is included or the demo uses a server-enforced anonymous session.
- Which dashboard metrics are backed by real application data.
- Whether charts are justified by available historical data.
- Whether a profile/settings area is necessary for the hackathon demo.

**Non-negotiable:** the design must never obscure the distinction between an indicative currency estimate, a payment awaiting approval, a provider-reported status, and a server-verified Sandbox capture.
