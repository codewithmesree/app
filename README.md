# GlobalPay

GlobalPay is a responsive travel-payments prototype for exploring destination merchants, indicative currency estimates, and a PayPal Sandbox checkout flow. It uses Next.js, TypeScript, Prisma, and MySQL.

## What works in this prototype

- Anonymous demo sessions are restored from an HttpOnly cookie. Onboarding preferences are stored against that server-side session.
- Destination merchant discovery, demo QR identifier resolution, indicative FX quotes, transaction history, and session-owned receipt details are backed by API routes.
- Payment review uses a fixed, server-configured sample amount for each seeded demo merchant. The client cannot choose a different transaction amount.
- New payment orders and captures are initiated and verified by the server through PayPal Sandbox.
- The guidance page is a static FAQ. There is no integrated AI model.

## Important limitations

- PayPal Sandbox is for testing only; no real payment, settlement, or transfer occurs.
- Bank linking is simulated with mock institution/account details. There is no real bank, Open Banking, or credential integration.
- Exchange rates are indicative reference rates from the European Central Bank via Frankfurter. They are not guaranteed checkout, zero-markup, or settlement rates.
- Merchants and their displayed demo amounts are illustrative catalogue data, not current merchant offers or prices.
- This is a responsive web prototype; offline behavior and PWA installation are not implemented.

## Local setup (Windows PowerShell)

Run commands from this `app/` directory.

1. Install Node.js and MySQL, then install dependencies:

   ```powershell
   npm install
   ```

2. Create the `globalpay_dev` and `globalpay_shadow` MySQL databases and a least-privilege account. Copy the example environment file and set the database URLs and PayPal Sandbox values:

   ```powershell
   Copy-Item .env.example .env.local
   ```

   `DATABASE_URL` and `SHADOW_DATABASE_URL` are required by the Prisma schema. Set `NEXT_PUBLIC_APP_URL` to the local app origin. Configure a PayPal Sandbox client ID, server-only client secret, and the platform Sandbox payee email. The default PayPal API URL is the Sandbox endpoint. Frankfurter requires no API key.

3. Validate/generate the Prisma client, apply the checked-in migrations, and seed the demo merchant catalogue:

   ```powershell
   npx prisma validate
   npx prisma generate
   npm run db:migrate
   npm run db:seed
   ```

4. Start the development server:

   ```powershell
   npm run dev
   ```

   Open `http://localhost:3000`.

The checked-in migrations create and update the database schema. The seed command is idempotent and updates the curated demo merchant records. Never commit `.env.local` or real credentials.

## Common commands

```powershell
npm run lint
npm run test
npx tsc --noEmit
npm run build
```

See the project specifications in `../mdfiles/` for the [architecture](../mdfiles/architecture.md), [API contract](../mdfiles/api-contract.md), [database schema](../mdfiles/database-schema.md), [payment flow](../mdfiles/payment-flow.md), and [threat model](../mdfiles/threat-model.md).

## Manual demo checklist

Manual browser and Sandbox testing has not been performed as part of this engineering phase. Before recording a demo:

1. Open a fresh browser session, complete onboarding, refresh, and confirm the same session and preferences are restored.
2. Change destinations and confirm the merchant catalogue updates; open a merchant from discovery and from a supported demo QR.
3. Confirm indicative quotes show the provider/source context and do not appear as guaranteed checkout rates.
4. Complete and refresh the mock bank-linking flow; verify the UI explicitly identifies it as simulated. Try the simulated failure path as well.
5. Review the merchant's sample amount and currency, then create a PayPal Sandbox order using Sandbox buyer credentials.
6. Test both PayPal approval and cancel returns. Confirm the transaction status comes from the server and review the session-owned receipt/history.
7. In a separate browser session, confirm a transaction receipt cannot be opened by a different session.
8. If an order outcome is unconfirmed, check transaction history and retry only the same payment attempt; do not create a second attempt until status is resolved.
