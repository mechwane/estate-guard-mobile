export type HouseholdProfile = {
  id: string;
  full_name: string;
  approved: boolean | null;
  verification_status: string | null;
  occupant_type: string | null;
  block: string | null;
  street: string | null;
  house_number: string | null;
  unit: string | null;
};

/** Human readable address for a profile, used to group households. */
export function addressOf(p: HouseholdProfile) {
  const parts = [p.house_number, p.street, p.block].filter(Boolean) as string[];
  const label = parts.join(" ").trim();
  return label || p.unit || "Unassigned address";
}

/** URL-safe key for an address (reversible enough for matching). */
export function addressKey(address: string) {
  return encodeURIComponent(address.trim().toLowerCase().replace(/\s+/g, "-"));
}

export function matchesAddressKey(address: string, key: string) {
  return addressKey(address) === key;
}

const TYPE_RULES: Array<[RegExp, string]> = [
  [/duplex/i, "Duplex"],
  [/bungalow/i, "Bungalow"],
  [/terrace/i, "Terrace"],
  [/flat|apartment/i, "Flat"],
  [/shop|store|office/i, "Commercial"],
];

export function houseTypeOf(address: string) {
  for (const [re, label] of TYPE_RULES) if (re.test(address)) return label;
  return "Residential";
}
