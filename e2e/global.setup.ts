import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })
import { clerkSetup } from '@clerk/testing/playwright'
import { test as setup } from '@playwright/test'

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
