/**
 * Display-only formatting for API decimal strings (api-contract.md section 3.2).
 * Works on the string so a value is never rounded through a binary float.
 */
export function formatDecimal(amount: string): string {
  const [whole, fraction] = amount.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}
