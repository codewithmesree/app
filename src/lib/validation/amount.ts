export type AmountValidation = { valid: true; amount: string } | { valid: false; message: string };

const MAX_WHOLE_DIGITS = 9;

/**
 * Plain-language checks for a typed amount (designs.md section 7). This only
 * guards the UI: the server must validate every amount again at its boundary.
 */
export function validateAmount(input: string, currency: string, decimals: number): AmountValidation {
  const value = input.trim();

  if (!value) {
    return { valid: false, message: "Enter an amount." };
  }
  if (!/^\d+(\.\d*)?$/.test(value)) {
    return { valid: false, message: "Use digits and one decimal point only, for example 250.00." };
  }

  const [whole, fraction = ""] = value.split(".");

  if (whole.replace(/^0+/, "").length > MAX_WHOLE_DIGITS) {
    return { valid: false, message: "That amount is too large to estimate." };
  }
  if (fraction.length > decimals) {
    return {
      valid: false,
      message:
        decimals === 0
          ? `${currency} amounts don't use decimal places.`
          : `${currency} amounts can have up to ${decimals} decimal places.`,
    };
  }
  if (/^0*$/.test(whole) && /^0*$/.test(fraction)) {
    return { valid: false, message: "Enter an amount greater than 0." };
  }

  return { valid: true, amount: fraction ? `${whole}.${fraction}` : whole };
}
