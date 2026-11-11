const DEMO_QR_IDENTIFIER_PATTERN = /^qr_demo_[a-z]{2}_[a-z0-9]+(?:_[a-z0-9]+)*_\d{2}$/;
const MAX_DEMO_QR_IDENTIFIER_LENGTH = 64;

export function isDemoQrIdentifier(value: string): boolean {
  return (
    value.length <= MAX_DEMO_QR_IDENTIFIER_LENGTH &&
    DEMO_QR_IDENTIFIER_PATTERN.test(value)
  );
}

export function getMerchantPaymentHref(merchantId: string): string {
  return `/pay?merchantId=${encodeURIComponent(merchantId)}`;
}
