// Set once the "Atlas Sky Pass" checkout link exists in Polar (created via
// Polar MCP -- product id 1bf30516-1449-4b67-8fdb-c5616d5d4232, org
// "Landnam Ventures"). Leave blank to no-op the paywall CTA rather than
// link to a dead URL.
export const POLAR_CHECKOUT_URL = import.meta.env.VITE_POLAR_CHECKOUT_URL as string | undefined
