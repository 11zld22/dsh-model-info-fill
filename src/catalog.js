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

export function emptyDefaults() {
  return {
    contextWindow: DEFAULT_CONTEXT_WINDOW,
    maxTokens: DEFAULT_MAX_TOKENS,
    image: false,
    thinkingLevels: ['off', 'low', 'medium', 'high'],
    providerReasoning: null,
  }
}

export function emptyCatalogFile() {
  return {
    version: 1,
    updatedAt: '',
    autoFill: true,
    defaults: emptyDefaults(),
    models: [],
  }
}

export function parseDefaults(raw) {
  const base = emptyDefaults()
  const record = asRecord(raw)
  if (!record) return base
  if (isPositiveInt(record.contextWindow)) base.contextWindow = record.contextWindow
  if (isPositiveInt(record.maxTokens)) base.maxTokens = record.maxTokens
  base.image = record.image === true
  const levels = sanitizeThinkingLevels(record.thinkingLevels)
  if (levels.length > 0) base.thinkingLevels = levels
  const reasoning = typeof record.providerReasoning === 'string' ? record.providerReasoning.trim() : null
  base.providerReasoning = THINKING_LEVELS.includes(reasoning) ? reasoning : null
  return base
}

export function defaultsInput(defaults) {
  return defaults?.image ? ['text', 'image'] : [...DEFAULT_INPUT]
}

export function thinkingLevelsFromEfforts(value) {
  if (value === false || value == null) return []
  const record = asRecord(value)
  if (!record) return []
  return THINKING_LEVELS.filter((level) => {
    if (!Object.prototype.hasOwnProperty.call(record, level)) return false
    if (level === 'off') return record[level] === null || typeof record[level] === 'string'
    return typeof record[level] === 'string' && record[level].length > 0
  })
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

/** Why a catalog hit states no discrete DSH thinking level. */
const THINKING_GAP_NOTES = Object.freeze({
  toggle: '百科只有思考开关，没有分档',
  budget: '百科按 token 预算控制思考，不是具名档位',
  'toggle-budget': '百科是思考开关和 token 预算，没有具名档位',
  unspecified: '百科只标明会思考，没有写出档位',
})

/**
 * Discrete thinking levels a models.dev entry actually states.
 *
 * DSH treats `reasoningEfforts` as a closed set and refuses an effort the
 * declaration does not offer. A boolean `reasoning: true`, a `toggle`, or a
 * `budget_tokens` option affirms reasoning without naming those levels, so
 * the result is `levels: null` (leave the field unset) rather than a guessed
 * `minimal/low/medium/high`. An explicit `effort` list is returned as stated.
 * No reasoning signal at all is an empty list, which fills as `false`.
 * @param {object} entry
 * @returns {{ levels: string[] | null, gap: string | null }}
 */
function thinkingFromEntry(entry) {
  const options = Array.isArray(entry.reasoning_options) ? entry.reasoning_options : []
  let effortValues = null
  let hasToggle = false
  let hasBudget = false
  for (const option of options) {
    const record = asRecord(option)
    if (!record) continue
    if (record.type === 'effort' && Array.isArray(record.values)) {
      if (effortValues === null) effortValues = record.values
    } else if (record.type === 'toggle') {
      hasToggle = true
    } else if (record.type === 'budget_tokens') {
      hasBudget = true
    }
  }
  if (effortValues !== null) {
    return { levels: sanitizeThinkingLevels(effortValues), gap: null }
  }
  if (hasToggle || hasBudget) {
    const gap = hasToggle && hasBudget ? 'toggle-budget' : hasToggle ? 'toggle' : 'budget'
    return { levels: null, gap }
  }
  if (entry.reasoning === true) return { levels: null, gap: 'unspecified' }
  return { levels: [], gap: null }
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
      const thinking = thinkingFromEntry(entry)
      models.push({
        id: entry.id.trim(),
        name: typeof entry.name === 'string' ? entry.name : entry.id,
        provider: providerName,
        contextWindow: asNumber(limit?.context),
        maxOutput: asNumber(limit?.output),
        input: sanitizeInput(modalities?.input ?? ['text']),
        thinkingLevels: thinking.levels,
        thinkingGap: thinking.gap,
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

export function fillModelEntry(entry, models, defaults = emptyDefaults()) {
  if (!entry || typeof entry !== 'object') return { model: entry, changed: false, matched: false }
  const id = typeof entry.id === 'string' ? entry.id.trim() : ''
  if (!id) return { model: entry, changed: false, matched: false }

  const next = clonePlain(entry)
  next.id = id
  const hit = lookupCatalogModel(models, id)
  const matched = Boolean(hit)
  let changed = false
  const fallback = parseDefaults(defaults)

  if (missingCapacity(next.contextWindow)) {
    next.contextWindow = hit?.contextWindow ?? fallback.contextWindow
    changed = true
  }
  if (missingCapacity(next.maxTokens)) {
    next.maxTokens = hit?.maxOutput ?? fallback.maxTokens
    changed = true
  }
  if (missingInput(next.input)) {
    next.input = hit ? sanitizeInput(hit.input) : defaultsInput(fallback)
    changed = true
  }
  if (missingReasoning(next.reasoningEfforts)) {
    if (hit && hit.thinkingLevels === null) {
      // Catalog hit, but no discrete levels to declare. An empty object is
      // not valid DSH config, so drop it; a missing field stays missing.
      if (next.reasoningEfforts !== undefined) {
        delete next.reasoningEfforts
        changed = true
      }
    } else {
      next.reasoningEfforts = hit
        ? reasoningEffortsFromLevels(hit.thinkingLevels)
        : reasoningEffortsFromLevels(fallback.thinkingLevels)
      changed = true
    }
  }
  if ((next.name === undefined || next.name === '') && hit?.name) {
    next.name = hit.name
    changed = true
  }

  return { model: next, changed, matched }
}

function configuredModels(config) {
  const providers = asRecord(config?.providers)
  if (!providers) return []
  const found = []
  for (const [provider, profile] of Object.entries(providers)) {
    if (!isProviderKey(provider)) continue
    const record = asRecord(profile)
    if (!record || !Array.isArray(record.models)) continue
    const displayName = typeof record.displayName === 'string' && record.displayName.trim()
      ? record.displayName.trim()
      : provider
    const providerReasoning = typeof record.reasoning === 'string' ? record.reasoning : null
    for (const entry of record.models) {
      const id = typeof entry?.id === 'string' ? entry.id.trim() : ''
      if (!id) continue
      found.push({ provider, displayName, providerReasoning, id, entry })
    }
  }
  return found
}

function modelReport(item) {
  const { entry } = item
  return {
    provider: item.provider,
    displayName: item.displayName,
    id: item.id,
    name: typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : item.id,
    contextWindow: isPositiveInt(entry.contextWindow) ? entry.contextWindow : null,
    maxTokens: isPositiveInt(entry.maxTokens) ? entry.maxTokens : null,
    image: Array.isArray(entry.input) && entry.input.includes('image'),
    thinkingLevels: thinkingLevelsFromEfforts(entry.reasoningEfforts),
    providerReasoning: THINKING_LEVELS.includes(item.providerReasoning) ? item.providerReasoning : null,
  }
}

export function listUnmatched(config, models) {
  return configuredModels(config)
    .filter((item) => !lookupCatalogModel(models, item.id))
    .map(modelReport)
}

export function listThinkingGaps(config, models) {
  const gaps = []
  for (const item of configuredModels(config)) {
    const hit = lookupCatalogModel(models, item.id)
    if (!hit || hit.thinkingLevels !== null) continue
    if (!missingReasoning(item.entry.reasoningEfforts)) continue
    gaps.push({
      ...modelReport(item),
      thinkingGap: typeof hit.thinkingGap === 'string' ? hit.thinkingGap : 'unspecified',
      note: THINKING_GAP_NOTES[hit.thinkingGap] ?? THINKING_GAP_NOTES.unspecified,
    })
  }
  return gaps
}

export function applyModelPatch(entry, patch, defaults = emptyDefaults()) {
  const fallback = parseDefaults(defaults)
  const next = clonePlain(entry)
  const id = typeof next.id === 'string' ? next.id.trim() : ''
  if (!id) return next
  next.id = id
  if (isPositiveInt(patch.contextWindow)) next.contextWindow = patch.contextWindow
  else if (missingCapacity(next.contextWindow)) next.contextWindow = fallback.contextWindow
  if (isPositiveInt(patch.maxTokens)) next.maxTokens = patch.maxTokens
  else if (missingCapacity(next.maxTokens)) next.maxTokens = fallback.maxTokens
  if (typeof patch.image === 'boolean') next.input = patch.image ? ['text', 'image'] : ['text']
  else if (missingInput(next.input)) next.input = defaultsInput(fallback)
  if (Array.isArray(patch.thinkingLevels)) {
    next.reasoningEfforts = reasoningEffortsFromLevels(patch.thinkingLevels)
  } else if (missingReasoning(next.reasoningEfforts)) {
    next.reasoningEfforts = reasoningEffortsFromLevels(fallback.thinkingLevels)
  }
  return next
}

export function buildFillOps(config, models, onlyProvider, defaults = emptyDefaults()) {
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
      const result = fillModelEntry(entry, models, defaults)
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

export function buildModelSaveOps(config, patch, defaults = emptyDefaults()) {
  const provider = typeof patch.provider === 'string' ? patch.provider.trim() : ''
  const id = typeof patch.id === 'string' ? patch.id.trim() : ''
  if (!isProviderKey(provider) || !id) {
    throw new Error('provider and model id are required')
  }
  const providers = asRecord(config?.providers)
  const profile = asRecord(providers?.[provider])
  const list = Array.isArray(profile?.models) ? profile.models : []
  const index = list.findIndex((entry) => entry?.id === id)
  if (index < 0) throw new Error(`model "${id}" was not found on ${provider}`)

  const nextModels = list.map((entry, i) => (i === index ? applyModelPatch(entry, patch, defaults) : clonePlain(entry)))
  const ops = [{
    op: 'set',
    path: ['providers', provider, 'models'],
    value: nextModels,
  }]
  const reasoning = typeof patch.providerReasoning === 'string' ? patch.providerReasoning.trim() : null
  if (reasoning && THINKING_LEVELS.includes(reasoning)) {
    ops.push({
      op: 'set',
      path: ['providers', provider, 'reasoning'],
      value: reasoning,
    })
  }
  return ops
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
    defaults: parseDefaults(record.defaults),
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
