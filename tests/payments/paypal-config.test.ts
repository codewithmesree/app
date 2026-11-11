import { after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { getPayPalConfig } from "@/lib/paypal/paypal-config";

const originalPayeeEmail = process.env.PAYPAL_PAYEE_EMAIL;
const originalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
const originalClientSecret = process.env.PAYPAL_CLIENT_SECRET;

describe("PayPal Sandbox configuration", () => {
  beforeEach(() => {
    process.env.PAYPAL_PAYEE_EMAIL = "platform-merchant@globalpay.test";
    process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID = "sandbox-client-id";
    process.env.PAYPAL_CLIENT_SECRET = "sandbox-client-secret";
  });

  after(() => {
    if (originalPayeeEmail === undefined) delete process.env.PAYPAL_PAYEE_EMAIL;
    else process.env.PAYPAL_PAYEE_EMAIL = originalPayeeEmail;
    if (originalClientId === undefined) delete process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    else process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID = originalClientId;
    if (originalClientSecret === undefined) delete process.env.PAYPAL_CLIENT_SECRET;
    else process.env.PAYPAL_CLIENT_SECRET = originalClientSecret;
  });

  it("rejects payment configuration when PAYPAL_PAYEE_EMAIL is missing", () => {
    delete process.env.PAYPAL_PAYEE_EMAIL;

    assert.throws(
      () => getPayPalConfig(),
      (error: unknown) =>
        error instanceof Error && error.message === "PAYPAL_CONFIGURATION_INVALID_PAYEE_EMAIL"
    );
  });

  it("rejects an invalid configured payee email", () => {
    process.env.PAYPAL_PAYEE_EMAIL = "not-an-email";

    assert.throws(
      () => getPayPalConfig(),
      (error: unknown) =>
        error instanceof Error && error.message === "PAYPAL_CONFIGURATION_INVALID_PAYEE_EMAIL"
    );
  });

  it("accepts and returns a valid configured Sandbox payee", () => {
    process.env.PAYPAL_PAYEE_EMAIL = "platform-merchant@globalpay.test";

    assert.strictEqual(getPayPalConfig().payeeEmail, "platform-merchant@globalpay.test");
  });
});
