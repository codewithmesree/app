import type { CountryCode } from "./countries";

const DCC_GUIDANCE =
  "If a card terminal offers to charge you in your home currency, compare it with paying in the local currency. That conversion can include a markup.";

/** General, hand-written travel notes. Not merchant-specific and not checked against a live source. */
const LOCAL_NOTES: Partial<Record<CountryCode, { title: string; note: string }>> = {
  JP: { title: "IC transit cards", note: "Prepaid IC cards such as Suica are widely used on trains and at convenience stores." },
  GB: { title: "Contactless transit", note: "London's public transport accepts contactless cards at the gate." },
  SG: { title: "Contactless transit", note: "Singapore's public transport accepts contactless cards at the gate." },
};

export function getPaymentGuidance(country: CountryCode) {
  return { dcc: DCC_GUIDANCE, local: LOCAL_NOTES[country] ?? null };
}
