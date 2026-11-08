// =============================================================================
// GlobalPay — Supported Demo Banking Institutions
// =============================================================================
// Server-side catalogue of institutions used exclusively for simulated
// open-banking linking. No real accounts or credentials are ever used.
// =============================================================================

export interface DemoInstitution {
  id: string;
  name: string;
  accountType: string;
  maskedNumber: string;
  country: string;
}

export const DEMO_INSTITUTIONS: Record<string, DemoInstitution> = {
  chase: {
    id: "chase",
    name: "Chase Bank",
    accountType: "Travel Checking",
    maskedNumber: "•••• 4821",
    country: "US",
  },
  barclays: {
    id: "barclays",
    name: "Barclays UK",
    accountType: "International Premier",
    maskedNumber: "•••• 7741",
    country: "GB",
  },
  deutsche: {
    id: "deutsche",
    name: "Deutsche Bank",
    accountType: "Girokonto Global",
    maskedNumber: "•••• 3190",
    country: "DE",
  },
  mizuho: {
    id: "mizuho",
    name: "Mizuho Bank",
    accountType: "Standard Deposit",
    maskedNumber: "•••• 6523",
    country: "JP",
  },
};

export function getDemoInstitution(id: string): DemoInstitution {
  return DEMO_INSTITUTIONS[id.toLowerCase()] ?? DEMO_INSTITUTIONS.chase;
}

