import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  POST_PAYMENT_REDIRECT_DELAY_MS,
  POST_PAYMENT_REDIRECT_PATH,
  shouldRedirectAfterPayment,
} from "@/lib/payments/post-payment-redirect";

describe("Post-payment dashboard redirect policy", () => {
  it("redirects only after the backend confirms COMPLETED", () => {
    assert.strictEqual(shouldRedirectAfterPayment({ status: "COMPLETED" }), true);
  });

  for (const status of ["CREATED", "AWAITING_APPROVAL", "CAPTURE_PENDING", "STATUS_UNKNOWN", "FAILED", "CANCELLED"]) {
    it(`does not redirect for ${status}`, () => {
      assert.strictEqual(shouldRedirectAfterPayment({ status }), false);
    });
  }

  it("does not redirect before a capture response exists or for malformed responses", () => {
    assert.strictEqual(shouldRedirectAfterPayment(null), false);
    assert.strictEqual(shouldRedirectAfterPayment(undefined), false);
    assert.strictEqual(shouldRedirectAfterPayment({}), false);
    assert.strictEqual(shouldRedirectAfterPayment({ status: "completed" }), false);
  });

  it("targets the dashboard after roughly 2-3 seconds", () => {
    assert.strictEqual(POST_PAYMENT_REDIRECT_PATH, "/dashboard");
    assert.ok(POST_PAYMENT_REDIRECT_DELAY_MS >= 2_000 && POST_PAYMENT_REDIRECT_DELAY_MS <= 3_000);
  });
});
