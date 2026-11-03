import type { LinkedBankAccount } from "./bank-linking-types";

/**
 * Sample mock bank accounts used strictly for the frontend milestone simulation.
 * Full account numbers, PINs, passwords and OTPs are NEVER collected or stored.
 */
export const SAMPLE_LINKED_ACCOUNT: LinkedBankAccount = {
  institutionName: "Chase Travel Checking",
  maskedAccountNumber: "•••• 4821",
  accountType: "Checking Account",
  holderLabel: "Alex Traveller",
  linkedAt: new Date().toISOString(),
};

export const MOCK_BANKS_CATALOG = [
  {
    id: "chase",
    name: "Chase Bank",
    accountType: "Travel Checking",
    maskedNumber: "•••• 4821",
    country: "US",
  },
  {
    id: "barclays",
    name: "Barclays UK",
    accountType: "International Premier",
    maskedNumber: "•••• 7741",
    country: "GB",
  },
  {
    id: "deutsche",
    name: "Deutsche Bank",
    accountType: "Girokonto Global",
    maskedNumber: "•••• 3190",
    country: "DE",
  },
  {
    id: "mizuho",
    name: "Mizuho Bank",
    accountType: "Standard Deposit",
    maskedNumber: "•••• 6523",
    country: "JP",
  },
] as const;

