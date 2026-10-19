import assert from 'node:assert/strict'
import test from 'node:test'
import { isInjectedWebviewNoise } from '../src/lib/injectedNoise.mjs'

const noise = 'Non-Error promise rejection captured with value: Object Not Found Matching Id:3, MethodName:update, ParamCount:4'

test('drops the injected webview rejection in either exception shape', () => {
  assert.equal(isInjectedWebviewNoise({ event: '$exception', properties: { $exception_list: [{ type: 'UnhandledRejection', value: noise }] } }), true)
  assert.equal(isInjectedWebviewNoise({ event: '$exception', properties: { $exception_message: noise } }), true)
})

test('keeps real exceptions and non-exception events', () => {
  assert.equal(isInjectedWebviewNoise({ event: '$exception', properties: { $exception_list: [{ type: 'TypeError', value: "Cannot read properties of undefined (reading 'id')" }] } }), false)
  assert.equal(isInjectedWebviewNoise({ event: 'sync_failed', properties: { error: noise } }), false)
  assert.equal(isInjectedWebviewNoise(null), false)
})
