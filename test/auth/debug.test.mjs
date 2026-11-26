import { test } from 'node:test'
import assert from 'node:assert/strict'
import { authDebug } from '../../src/lib/authDebug.mjs'

test('staging diagnostics show useful errors without credentials', () => {
  const previousWindow = globalThis.window
  const previousConsole = globalThis.console
  const calls = []
  globalThis.window = { location: { hostname: 'staging.atlas-4xz.pages.dev', pathname: '/app/hub' } }
  globalThis.console = { groupCollapsed() {}, error: (...args) => calls.push(args), groupEnd() {} }
  try {
    authDebug('Password sign-in', { message: 'bad secret for test@example.com', errors: [{ code: 'bad', longMessage: 'secret rejected' }] }, { status: 401 }, ['secret'])
    const data = calls[0][1]
    assert.equal(data.status, 401)
    assert.equal(data.errors[0].code, 'bad')
    assert.equal(data.message, 'bad [redacted] for [email]')
    assert.equal(data.errors[0].longMessage, '[redacted] rejected')
    globalThis.window.location.hostname = 'youratlas.cc'
    authDebug('Password sign-in', { message: 'failure' })
    assert.equal(calls.length, 1)
  } finally {
    globalThis.window = previousWindow
    globalThis.console = previousConsole
  }
})
