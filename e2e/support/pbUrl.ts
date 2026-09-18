// Which PocketBase the e2e run talks to, resolved in one place so the
// Playwright config, the preflight check and the specs cannot disagree about
// it.
//
// Production is never localhost: VITE_PB_URL is inlined by Vite at build
// time, and the deployed build takes it from .env.production /
// vars.VITE_PB_URL (https://signal-k-starsailors.fly.dev). This default is
// purely the local-dev one.
//
// 8094 is not arbitrary and not stale -- it is what atlas/docker-compose.yml
// publishes (8094:8090). The monorepo's own root docker-compose.yml builds
// the same backend but publishes it on 8090, so which port is live depends
// entirely on which stack is up, and running the root one leaves this default
// pointing at nothing. Hence checkPocketBaseReachable below.
export const DEFAULT_PB_URL = 'http://localhost:8094'

export function resolvePbUrl(): string {
  return process.env.E2E_WRITE_PB_URL || process.env.VITE_PB_URL || DEFAULT_PB_URL
}

// Reports whether PocketBase is actually listening, with an explanation
// aimed at the failure this prevents rather than at the HTTP status.
//
// Four specs complete a real round trip through POST /auth/clerk-exchange.
// When nothing is listening, that fetch rejects deep inside a helper and the
// run fails as a 45s UI timeout on a sign-in form -- which looks like a Clerk
// or selector problem and says nothing about a port. It is also how this
// repo leaked 34 Clerk users: the failure landed between creating a test user
// and the cleanup that deletes it.
export async function checkPocketBaseReachable(pbUrl: string): Promise<string | null> {
  try {
    const response = await fetch(`${pbUrl}/api/health`, { signal: AbortSignal.timeout(5_000) })
    if (!response.ok) return `${pbUrl}/api/health returned ${response.status}`
    return null
  } catch (error) {
    return `${pbUrl} is not reachable (${error instanceof Error ? error.message : String(error)})`
  }
}

export function pocketBaseHelp(pbUrl: string): string {
  return [
    `PocketBase is not answering at ${pbUrl}.`,
    'The specs that exercise sign-in complete a real POST /auth/clerk-exchange, so they need one running.',
    'Start the Atlas stack (docker compose up backend, from atlas/ -- publishes 8094),',
    'or point at the monorepo root stack instead: VITE_PB_URL=http://localhost:8090 npm run test:e2e.',
  ].join('\n  ')
}
