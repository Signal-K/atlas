import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })
import { clerkSetup } from '@clerk/testing/playwright'
import { test as setup } from '@playwright/test'
import { checkPocketBaseReachable, pocketBaseHelp, resolvePbUrl } from './support/pbUrl'

// Clerk's testing token has to be fetched once before any spec that renders
// <SignIn>/<SignUp> runs, and Playwright's default full-parallel mode would
// otherwise race multiple specs into requesting it at once.
setup.describe.configure({ mode: 'serial' })

setup('clerk global setup', async () => {
  if (!process.env.VITE_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) {
    throw new Error(
      'VITE_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY must be set (see atlas/.env.local) to run the Clerk-backed e2e specs.',
    )
  }
  await clerkSetup({
    publishableKey: process.env.VITE_CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
  })
})

// Warn rather than throw: most specs seed a PocketBase session into
// localStorage and never touch the server, so an unreachable backend must not
// block the whole suite. The four that do need it fail with this same
// explanation attached (see primeClerkPocketBaseLink), instead of as an
// unexplained timeout on a sign-in form.
setup('pocketbase preflight', async () => {
  const pbUrl = resolvePbUrl()
  const problem = await checkPocketBaseReachable(pbUrl)
  if (problem) console.warn(`\n  ⚠ ${problem}\n  ${pocketBaseHelp(pbUrl)}\n`)
})
