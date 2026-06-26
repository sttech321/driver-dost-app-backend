// Predefined "Add Money" packages — the single source of truth for what a user
// pays vs. how much lands in their wallet. Bonus is optional (0 = plain amount).
// All values in rupees. Edit here to change the offering (no DB needed).
export const WALLET_PACKAGES = [
  { id: 'pkg_100', pay: 100, bonus: 0 },
  { id: 'pkg_500', pay: 500, bonus: 50 },
  { id: 'pkg_1000', pay: 1000, bonus: 150 },
  { id: 'pkg_2000', pay: 2000, bonus: 400 },
];

// Bounds for a manual (custom) top-up amount, in rupees.
export const MANUAL_MIN = 10;
export const MANUAL_MAX = 100000;
