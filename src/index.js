import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import {
  LLM_PI_AI_NS,
  MODELS_DEV_URL,
  buildFillOps,
  buildModelSaveOps,
  catalogIsStale,
  emptyCatalogFile,
  listUnmatched,
  parseCatalogFile,
  parseDefaults,
  parseModelsDev,
} from './catalog.js'

export const name = 'dsh-model-info-fill'
export const inject = ['settings', 'timer']

const FETCH_TIMEOUT_MS = 60_000
const PREFIX = '/plugins/models-dev-catalog'

function dataDir() {
  const configured = process.env.DSH_HOME?.trim()
  return configured || join(homedir(), '.dsh')
}

function catalogPath() {
  return join(dataDir(), 'models-dev.json')
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}

function send(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(body))
}

function isTrustedRequest(req) {
  const address = req.socket?.remoteAddress || ''
  if (address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1') return true
  const host = req.headers?.host || ''
  const origin = req.headers?.origin || ''
  if (!origin) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

async function readJsonBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const text = Buffer.concat(chunks).toString('utf8').trim()
  if (!text) return {}
  return JSON.parse(text)
}

export function apply(ctx) {
  const store = {
    file: emptyCatalogFile(),
    filling: false,
    refreshing: false,
  }

  const currentConfig = () => {
    try {
      return ctx.settings.get(LLM_PI_AI_NS)
    } catch {
      return { providers: {} }
    }
  }

  const status = () => ({
    ok: true,
    updatedAt: store.file.updatedAt,
    modelCount: store.file.models.length,
    autoFill: store.file.autoFill !== false,
    defaults: store.file.defaults,
    unmatched: listUnmatched(currentConfig(), store.file.models),
    filling: store.filling,
    refreshing: store.refreshing,
  })

  const persist = async () => {
    const path = catalogPath()
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, `${JSON.stringify(store.file)}\n`, 'utf8')
  }

  const loadCache = async () => {
    try {
      const raw = JSON.parse(await readFile(catalogPath(), 'utf8'))
      store.file = parseCatalogFile(raw)
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        store.file = emptyCatalogFile()
        return
      }
      throw error
    }
  }

  const refreshCatalog = async () => {
    if (store.refreshing) return store.file
    store.refreshing = true
    try {
      const response = await fetch(MODELS_DEV_URL, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { accept: 'application/json' },
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      store.file = {
        version: 1,
        updatedAt: new Date().toISOString(),
        autoFill: store.file.autoFill !== false,
        defaults: parseDefaults(store.file.defaults),
        models: parseModelsDev(data),
      }
      await persist()
      return store.file
    } finally {
      store.refreshing = false
    }
  }

  const llmRevision = () => {
    const rows = ctx.settings.describe({ redactSecrets: true })
    const row = rows.find((item) => String(item.ns) === LLM_PI_AI_NS)
    return row?.revision
  }

  const fillSettings = async (onlyProvider) => {
    const settings = ctx.settings
    const config = settings.get(LLM_PI_AI_NS)
    const { ops, filledProviders } = buildFillOps(config, store.file.models, onlyProvider, store.file.defaults)
    if (ops.length === 0) {
      return { ok: true, filled: 0, providers: [], skipped: true }
    }
    if (store.filling) {
      return { ok: true, filled: 0, providers: [], skipped: true }
    }
    store.filling = true
    try {
      await settings.mutate(LLM_PI_AI_NS, ops, llmRevision())
      return { ok: true, filled: filledProviders.length, providers: filledProviders }
    } finally {
      store.filling = false
    }
  }

  const maybeAutoFill = () => {
    if (store.file.autoFill === false) return
    ctx.timeout(() => {
      fillSettings().catch((error) => {
        ctx.logger?.warn?.(`[models-dev-catalog] auto-fill failed: ${messageOf(error)}`)
      })
    }, 0)
  }

  ctx.on('settings/updated', (ns) => {
    if (String(ns) !== LLM_PI_AI_NS) return
    if (store.filling) return
    maybeAutoFill()
  })

  let registered = false
  const registerWeb = () => {
    if (registered) return true
    const webServer = ctx.get('webServer') ?? ctx.get('httpServer')
    if (webServer === undefined) return false
    registered = true

    const route = (pathname, handler) => {
      ctx.effect(
        () => webServer.register({ kind: 'exact', path: pathname, handler }),
        `models-dev-catalog: ${pathname}`,
      )
    }

    const guard = async (req, res, work) => {
      if (!isTrustedRequest(req)) {
        send(res, 403, { ok: false, error: 'forbidden' })
        return
      }
      try {
        await work()
      } catch (error) {
        send(res, 500, { ok: false, error: messageOf(error) })
      }
    }

    route(`${PREFIX}/status`, async (req, res) => {
      await guard(req, res, async () => {
        send(res, 200, status())
      })
    })

    route(`${PREFIX}/refresh`, async (req, res) => {
      await guard(req, res, async () => {
        if (req.method !== 'POST') {
          send(res, 405, { ok: false, error: 'method not allowed' })
          return
        }
        const file = await refreshCatalog()
        send(res, 200, status())
      })
    })

    route(`${PREFIX}/fill`, async (req, res) => {
      await guard(req, res, async () => {
        if (req.method !== 'POST') {
          send(res, 405, { ok: false, error: 'method not allowed' })
          return
        }
        const body = await readJsonBody(req).catch(() => ({}))
        const provider = typeof body.provider === 'string' ? body.provider.trim() : ''
        const result = await fillSettings(provider || undefined)
        send(res, 200, { ...status(), ...result })
      })
    })

    route(`${PREFIX}/prefs`, async (req, res) => {
      await guard(req, res, async () => {
        if (req.method !== 'POST') {
          send(res, 405, { ok: false, error: 'method not allowed' })
          return
        }
        const body = await readJsonBody(req).catch(() => ({}))
        if (typeof body.autoFill === 'boolean') store.file.autoFill = body.autoFill
        if (body.defaults !== undefined) store.file.defaults = parseDefaults(body.defaults)
        await persist()
        send(res, 200, status())
      })
    })

    route(`${PREFIX}/model`, async (req, res) => {
      await guard(req, res, async () => {
        if (req.method !== 'POST') {
          send(res, 405, { ok: false, error: 'method not allowed' })
          return
        }
        const body = await readJsonBody(req)
        const ops = buildModelSaveOps(currentConfig(), body, store.file.defaults)
        await ctx.settings.mutate(LLM_PI_AI_NS, ops, llmRevision())
        send(res, 200, status())
      })
    })

    return true
  }

  ctx.effect(() => {
    let disposed = false
    const start = async () => {
      try {
        await loadCache()
      } catch (error) {
        ctx.logger?.warn?.(`[models-dev-catalog] failed to load cache: ${messageOf(error)}`)
        store.file = emptyCatalogFile()
      }
      if (disposed) return
      if (catalogIsStale(store.file.updatedAt)) {
        refreshCatalog().catch((error) => {
          ctx.logger?.warn?.(`[models-dev-catalog] refresh failed: ${messageOf(error)}`)
        })
      }
      maybeAutoFill()
    }
    start()
    return () => {
      disposed = true
    }
  }, 'models-dev-catalog: cache')

  if (!registerWeb()) {
    ctx.effect(() => {
      const stop = ctx.interval(() => {
        if (registerWeb()) stop()
      }, 250)
      return stop
    }, 'models-dev-catalog: wait for web server')
  }
}
