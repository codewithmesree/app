const DECIMAL = /^\d+(\.\d+)?$/;
const TWO = BigInt(2);
const TEN = BigInt(10);

function parseDecimal(value: string): { units: bigint; scale: bigint } {
  if (!DECIMAL.test(value)) {
    throw new RangeError("Expected a non-negative decimal string.");
  }
  const [whole, fraction = ""] = value.split(".");
  return { units: BigInt(whole + fraction), scale: TEN ** BigInt(fraction.length) };
}

/**
 * Computes `value * multiplier / divisor` on decimal strings without binary
 * floats (architecture.md section 10). Rounds half up to `decimals` places.
 */
export function multiplyAndDivide(value: string, multiplier: string, divisor: string, decimals: number): string {
  const a = parseDecimal(value);
  const m = parseDecimal(multiplier);
  const d = parseDecimal(divisor);

  if (d.units === BigInt(0)) {
    throw new RangeError("Divisor must be greater than zero.");
  }

  const numerator = a.units * m.units * d.scale * TEN ** BigInt(decimals);
  const denominator = a.scale * m.scale * d.units;
  const rounded = ((TWO * numerator + denominator) / (TWO * denominator)).toString();

  if (decimals === 0) {
    return rounded;
  }
  const digits = rounded.padStart(decimals + 1, "0");
  return `${digits.slice(0, -decimals)}.${digits.slice(-decimals)}`;
}

/** Drops trailing zeros while keeping at least `minDecimals` places. */
export function trimDecimal(value: string, minDecimals = 2): string {
  const [whole, fraction = ""] = value.split(".");
  const trimmed = fraction.replace(/0+$/, "").padEnd(minDecimals, "0");
  return trimmed ? `${whole}.${trimmed}` : whole;
}
