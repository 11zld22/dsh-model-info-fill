/** Shared models.dev catalog: parse, lookup, and fill llm-pi-ai model fields. */

export const MODELS_DEV_URL = 'https://models.dev/api.json'

export const DEFAULT_CONTEXT_WINDOW = 262144
export const DEFAULT_MAX_TOKENS = 32768
export const DEFAULT_INPUT = Object.freeze(['text'])

export const MODALITIES = Object.freeze(['text', 'image'])
export const THINKING_LEVELS = Object.freeze([
  'off',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
])

export const DEFAULT_REASONING_EFFORTS = Object.freeze({
  off: null,
  low: 'low',
  medium: 'medium',
  high: 'high',
})

export const LLM_PI_AI_NS = 'llm-pi-ai'
export const STALE_MS = 7 * 24 * 60 * 60 * 1000
export const PROVIDER_KEY_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

export function emptyCatalogFile() {
  return {
    version: 1,
    updatedAt: '',
    autoFill: true,
    models: [],
  }
}

export function isPositiveInt(value) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

export function isProviderKey(value) {
  return typeof value === 'string' && PROVIDER_KEY_PATTERN.test(value.trim())
}

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function asNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

export function sanitizeInput(value) {
  if (!Array.isArray(value)) return [...DEFAULT_INPUT]
  const allowed = value.filter((item) => MODALITIES.includes(item))
  const unique = MODALITIES.filter((item) => allowed.includes(item))
  return unique.length > 0 ? unique : [...DEFAULT_INPUT]
}

export function sanitizeThinkingLevels(value) {
  if (!Array.isArray(value)) return []
  return THINKING_LEVELS.filter((level) => value.includes(level))
}

function thinkingFromEntry(entry) {
  const options = entry.reasoning_options
  if (Array.isArray(options)) {
    for (const option of options) {
      const record = asRecord(option)
      if (record?.type === 'effort' && Array.isArray(record.values)) {
        return sanitizeThinkingLevels(record.values)
      }
    }
  }
  if (entry.reasoning === true) return ['minimal', 'low', 'medium', 'high']
  return []
}

export function reasoningEffortsFromLevels(levels) {
  const enabled = sanitizeThinkingLevels(levels)
  const thinking = enabled.filter((level) => level !== 'off')
  if (thinking.length === 0) return false
  const efforts = { off: null }
  for (const level of thinking) efforts[level] = level
  return efforts
}

export function parseModelsDev(data) {
  const root = asRecord(data)
  if (!root) return []
  const models = []
  for (const provider of Object.values(root)) {
    const providerRecord = asRecord(provider)
    if (!providerRecord) continue
    const providerId = typeof providerRecord.id === 'string' ? providerRecord.id : ''
    const providerName = typeof providerRecord.name === 'string' ? providerRecord.name : providerId
    const nested = asRecord(providerRecord.models)
    if (!nested) continue
    for (const raw of Object.values(nested)) {
      const entry = asRecord(raw)
      if (!entry || typeof entry.id !== 'string' || !entry.id.trim()) continue
      const limit = asRecord(entry.limit)
      const modalities = asRecord(entry.modalities)
      models.push({
        id: entry.id.trim(),
        name: typeof entry.name === 'string' ? entry.name : entry.id,
        provider: providerName,
        contextWindow: asNumber(limit?.context),
        maxOutput: asNumber(limit?.output),
        input: sanitizeInput(modalities?.input ?? ['text']),
        thinkingLevels: thinkingFromEntry(entry),
      })
    }
  }
  return models
}

export function lookupCatalogModel(models, id) {
  const raw = String(id ?? '').trim().toLowerCase()
  if (!raw) return undefined
  const last = raw.split(/[/:]/).filter(Boolean).pop() ?? raw
  const exact = models.find((item) => item.id.toLowerCase() === raw)
  if (exact) return exact
  if (last !== raw) {
    const byTail = models.find((item) => item.id.toLowerCase() === last)
    if (byTail) return byTail
  }
  return models.find((item) => {
    const catalogId = item.id.toLowerCase()
    const catalogTail = catalogId.split(/[/:]/).filter(Boolean).pop() ?? catalogId
    return catalogTail === last
  })
}

export function clonePlain(value) {
  return JSON.parse(JSON.stringify(value))
}

function missingCapacity(value) {
  return !isPositiveInt(value)
}

function missingInput(value) {
  return !Array.isArray(value) || value.length === 0
}

function missingReasoning(value) {
  if (value === undefined) return true
  if (value === false) return false
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0
}

export function fillModelEntry(entry, models) {
  if (!entry || typeof entry !== 'object') return { model: entry, changed: false }
  const id = typeof entry.id === 'string' ? entry.id.trim() : ''
  if (!id) return { model: entry, changed: false }

  const next = clonePlain(entry)
  next.id = id
  const hit = lookupCatalogModel(models, id)
  let changed = false

  if (missingCapacity(next.contextWindow)) {
    next.contextWindow = hit?.contextWindow ?? DEFAULT_CONTEXT_WINDOW
    changed = true
  }
  if (missingCapacity(next.maxTokens)) {
    next.maxTokens = hit?.maxOutput ?? DEFAULT_MAX_TOKENS
    changed = true
  }
  if (missingInput(next.input)) {
    next.input = hit ? sanitizeInput(hit.input) : [...DEFAULT_INPUT]
    changed = true
  }
  if (missingReasoning(next.reasoningEfforts)) {
    next.reasoningEfforts = hit
      ? reasoningEffortsFromLevels(hit.thinkingLevels)
      : { ...DEFAULT_REASONING_EFFORTS }
    changed = true
  }
  if ((next.name === undefined || next.name === '') && hit?.name) {
    next.name = hit.name
    changed = true
  }

  return { model: next, changed }
}

export function buildFillOps(config, models, onlyProvider) {
  const providers = asRecord(config?.providers)
  if (!providers) return { ops: [], filledProviders: [] }

  const ops = []
  const filledProviders = []
  const keys = onlyProvider ? [onlyProvider] : Object.keys(providers)

  for (const key of keys) {
    if (!isProviderKey(key)) continue
    const profile = asRecord(providers[key])
    if (!profile) continue
    const list = profile.models
    if (!Array.isArray(list) || list.length === 0) continue

    let changed = false
    const nextModels = list.map((entry) => {
      const result = fillModelEntry(entry, models)
      if (result.changed) changed = true
      return result.model
    })
    if (!changed) continue
    ops.push({
      op: 'set',
      path: ['providers', key, 'models'],
      value: nextModels,
    })
    filledProviders.push(key)
  }

  return { ops, filledProviders }
}

export function parseCatalogFile(raw) {
  const empty = emptyCatalogFile()
  const record = asRecord(raw)
  if (!record) return empty
  const models = Array.isArray(record.models) ? record.models.filter((item) => asRecord(item) && typeof item.id === 'string') : []
  return {
    version: 1,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : '',
    autoFill: record.autoFill !== false,
    models,
  }
}

export function catalogIsStale(updatedAt, now = Date.now()) {
  if (!updatedAt) return true
  const time = Date.parse(updatedAt)
  if (!Number.isFinite(time)) return true
  return now - time > STALE_MS
}

export function formatCatalogStamp(updatedAt, count) {
  if (!updatedAt) return count ? `${count} 个模型` : '尚未更新'
  const date = new Date(updatedAt)
  if (Number.isNaN(date.getTime())) return count ? `${count} 个模型` : '尚未更新'
  const pad = (value) => String(value).padStart(2, '0')
  const stamp = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  return `${stamp} · ${count} 个模型`
}
