import test from 'node:test'
import assert from 'node:assert/strict'
import { apply } from '../src/index.js'

function harness(legacy, missing = false) {
  const routes = new Map()
  const events = new Map()
  const timers = []
  const writes = []
  let revision = 4
  const config = { providers: { custom: { models: [{ id: 'unknown-x' }] } } }
  const settings = {
    describe() {
      return missing ? [] : [{ ns: 'llm-pi-ai', revision, value: config }]
    },
    async mutate(ns, ops, expectedRevision) {
      assert.equal(ns, 'llm-pi-ai')
      assert.equal(expectedRevision, revision)
      writes.push(ops)
      for (const op of ops) {
        assert.equal(op.op, 'set')
        let parent = config
        for (const key of op.path.slice(0, -1)) parent = parent[key]
        parent[op.path.at(-1)] = op.value
      }
      revision++
    },
  }
  if (legacy) settings.get = () => config
  const webServer = { register({ path, handler }) { routes.set(path, handler) } }
  apply({
    settings,
    get(name) { return name === 'webServer' ? webServer : undefined },
    on(name, handler) { events.set(name, handler) },
    effect(fn, label) { if (label?.startsWith('models-dev-catalog: /')) fn() },
    timeout(fn) { timers.push(fn) },
  })

  async function request(path, body = {}) {
    const req = {
      method: 'POST',
      socket: { remoteAddress: '127.0.0.1' },
      async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify(body)) },
    }
    const response = { status: 0, body: null }
    const res = {
      writeHead(status) { response.status = status },
      end(data) { response.body = JSON.parse(data) },
    }
    await routes.get(`/plugins/models-dev-catalog/${path}`)(req, res)
    return response
  }
  return { config, events, request, timers, writes }
}

for (const legacy of [true, false]) {
  test(`${legacy ? '0.1.6' : '0.1.7'} settings can fill and save a model`, async () => {
    const app = harness(legacy)
    const filled = await app.request('fill', { provider: 'custom' })
    assert.equal(filled.status, 200)
    assert.equal(filled.body.filled, 1)
    assert.equal(app.config.providers.custom.models[0].contextWindow, 262144)
    assert.equal(app.writes.length, 1)

    const saved = await app.request('model', { provider: 'custom', id: 'unknown-x', contextWindow: 777 })
    assert.equal(saved.status, 200)
    assert.equal(app.config.providers.custom.models[0].contextWindow, 777)
    assert.equal(app.writes.length, 2)

    const event = legacy ? 'settings/updated' : 'settings/document-updated'
    assert.equal(typeof app.events.get(event), 'function')
    app.events.get(event)('llm-pi-ai')
    assert.equal(app.timers.length, 1)
  })
}

test('0.1.7 refuses to fill when the model settings entry is unavailable', async () => {
  const app = harness(false, true)
  const result = await app.request('fill')
  assert.equal(result.status, 500)
  assert.match(result.body.error, /Settings for llm-pi-ai are unavailable/)
  assert.equal(app.writes.length, 0)
})
