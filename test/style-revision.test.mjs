import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import test from 'node:test'
test('bootstrap recovery accepts the stylesheet shipped by this release', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8')
  const style = css.match(/--atlas-style-revision:\s*([^;]+);/)[1]
  const expected = html.match(/revision !== '([^']+)'/)[1]
  assert.equal(style, expected, 'Mismatched revisions trigger false recovery reloads in production')
})
