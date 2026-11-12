// =============================================================================
// GlobalPay — PayPal-supported transaction currencies
// =============================================================================
// PayPal REST API currency codes that a PayPal account can accept as payment
// (https://developer.paypal.com/api/rest/reference/currency-codes/).
// Currencies PayPal limits to in-country accounts (e.g. INR) are excluded
// because the GlobalPay Sandbox merchant is not an in-country account for them.
// payment-flow.md PF-17: unsupported currencies are rejected before any
// provider call. GlobalPay never converts the payment currency silently.
// =============================================================================

export const PAYPAL_SUPPORTED_CURRENCIES = [
  "AUD", "BRL", "CAD", "CHF", "CNY", "CZK", "DKK", "EUR", "GBP", "HKD", "HUF", "ILS",
  "JPY", "MXN", "MYR", "NOK", "NZD", "PHP", "PLN", "SEK", "SGD", "THB", "TWD", "USD",
] as const;

/** Commonly held currencies suggested to the user as alternatives. */
export const PAYPAL_SUGGESTED_CURRENCIES = ["USD", "EUR", "GBP", "SGD", "JPY"] as const;

export function isPayPalSupportedCurrency(currency: string): boolean {
  return (PAYPAL_SUPPORTED_CURRENCIES as readonly string[]).includes(currency.trim().toUpperCase());
}

export function unsupportedCurrencyMessage(currency: string): string {
  return (
    `PayPal Sandbox cannot accept payments in ${currency.toUpperCase()} for this merchant account. ` +
    `No payment was created and nothing was converted. Choose a merchant that charges in a supported currency ` +
    `such as ${PAYPAL_SUGGESTED_CURRENCIES.join(", ")}.`
  );
}
