import test from 'node:test'
import assert from 'node:assert/strict'
import { apply } from '../src/index.js'

function harness(legacy, missing = false, options = {}) {
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
    effect(fn, label) {
      if (label?.startsWith('models-dev-catalog: /')) fn()
      if (options.cache && label === 'models-dev-catalog: cache') fn()
    },
    timeout(fn) { timers.push(fn) },
  })

  async function request(path, body = {}, method = 'POST') {
    const req = {
      method,
      socket: { remoteAddress: '127.0.0.1' },
      async *[Symbol.asyncIterator]() {
        if (method !== 'GET') yield Buffer.from(JSON.stringify(body))
      },
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

test('confirming the fabricated levels dismisses the row without rewriting settings', async () => {
  const { mkdir, writeFile, rm } = await import('node:fs/promises')
  const home = 'C:/Users/miku/AppData/Local/Temp/dsh-model-info-fill-confirm'
  const previousHome = process.env.DSH_HOME
  process.env.DSH_HOME = home
  await rm(home, { recursive: true, force: true })
  await mkdir(home, { recursive: true })
  await writeFile(`${home}/models-dev.json`, `${JSON.stringify({
    version: 2,
    updatedAt: new Date().toISOString(),
    autoFill: false,
    models: [{
      id: 'switch-only',
      name: 'Switch',
      provider: 'Example',
      thinkingLevels: null,
      thinkingGap: 'unspecified',
    }],
  })}\n`)
  try {
    const app = harness(false, false, { cache: true })
    app.config.providers.custom.models[0] = {
      id: 'switch-only',
      reasoningEfforts: { off: null, minimal: 'minimal', low: 'low', medium: 'medium', high: 'high' },
    }
    let before = null
    for (let i = 0; i < 20; i += 1) {
      before = await app.request('status', {}, 'GET')
      if (before.body.legacyThinking.length === 1) break
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    assert.equal(before.body.legacyThinking.length, 1)
    const saved = await app.request('model', {
      provider: 'custom',
      id: 'switch-only',
      thinkingMode: 'levels',
      thinkingLevels: ['off', 'minimal', 'low', 'medium', 'high'],
      confirmLegacy: true,
    })
    assert.equal(saved.status, 200)
    assert.equal(app.writes.length, 0)
    assert.deepEqual(saved.body.legacyThinking, [])
    const again = await app.request('status', {}, 'GET')
    assert.deepEqual(again.body.legacyThinking, [])
  } finally {
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
  }
})

test('0.1.7 refuses to fill when the model settings entry is unavailable', async () => {
  const app = harness(false, true)
  const result = await app.request('fill')
  assert.equal(result.status, 500)
  assert.match(result.body.error, /Settings for llm-pi-ai are unavailable/)
  assert.equal(app.writes.length, 0)
})
