#!/usr/bin/env node
// Same pattern as pb-observer's scripts/generate-vapid-keys.js.
import webpush from 'web-push'

const keys = webpush.generateVAPIDKeys()
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`)
console.log()
console.log('Set VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY as GitHub repo secrets (for notify.yml),')
console.log('and VITE_VAPID_PUBLIC_KEY (the public key only) wherever the frontend is deployed.')
