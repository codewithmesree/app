// =============================================================================
// GlobalPay — Post-payment redirect policy
// =============================================================================
// After PayPal returns the user to /pay/return, the client asks the backend to
// capture the order. Only a backend-confirmed COMPLETED capture may trigger the
// automatic redirect to the dashboard. Pending, unknown, failed and cancelled
// outcomes keep the user on the status screen so they can see what happened.
// =============================================================================

export const POST_PAYMENT_REDIRECT_PATH = "/dashboard";
export const POST_PAYMENT_REDIRECT_DELAY_MS = 2_500;

/**
 * Returns true only when the server-side capture response confirms the
 * transaction completed. `capture` is the parsed capture API response (or null
 * when no response has been received yet).
 */
export function shouldRedirectAfterPayment(capture: { status?: unknown } | null | undefined): boolean {
  return capture?.status === "COMPLETED";
}
