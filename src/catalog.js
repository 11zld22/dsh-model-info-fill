/** Shared models.dev catalog: parse, lookup, and fill llm-pi-ai model fields. */

export const MODELS_DEV_URL = 'https://models.dev/api.json'

export const DEFAULT_CONTEXT_WINDOW = 262144
export const DEFAULT_MAX_TOKENS = 32768
export const DEFAULT_INPUT = Object.freeze(['text'])
export const DEFAULT_PROVIDER_REASONING = 'high'

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

/** Cache schema. Bumped when the parsed model shape changes, so an old cache is re-fetched. */
export const CATALOG_VERSION = 2

export const LLM_PI_AI_NS = 'llm-pi-ai'
export const STALE_MS = 7 * 24 * 60 * 60 * 1000
export const PROVIDER_KEY_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

export function emptyDefaults() {
  return {
    contextWindow: DEFAULT_CONTEXT_WINDOW,
    maxTokens: DEFAULT_MAX_TOKENS,
    image: false,
    thinkingLevels: ['off', 'low', 'medium', 'high'],
    providerReasoning: DEFAULT_PROVIDER_REASONING,
    providerReasoningStrict: true,
  }
}

export function emptyCatalogFile() {
  return {
    version: CATALOG_VERSION,
    updatedAt: '',
    autoFill: true,
    defaults: emptyDefaults(),
    models: [],
    confirmedLegacy: [],
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
  if (record.providerReasoning === null) base.providerReasoning = null
  else if (reasoning !== null && THINKING_LEVELS.includes(reasoning)) base.providerReasoning = reasoning
  base.providerReasoningStrict = record.providerReasoningStrict !== false
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

/** The levels one model entry accepts at request time, mirroring the adapter's resolution. */
export function supportedThinkingLevels(entry) {
  if (entry?.reasoningEfforts === false) return ['off']
  return thinkingLevelsFromEfforts(entry?.reasoningEfforts)
}

/**
 * Whether a provider's default thinking level may be written, so the level never
 * reaches a model that refuses it: the adapter throws UNSUPPORTED_REASONING_EFFORT
 * on a profile default its model does not offer.
 * @param profile - the provider profile being filled.
 * @param nextModels - the model entries as they will be after this fill.
 * @param configured - the default level from the plugin's own defaults.
 * @param strict - write the level only when every model takes it; false writes it anyway.
 * @returns the wanted level, the level to write (null to leave the profile alone), and the refusing model ids.
 */
export function planProviderReasoning(profile, nextModels, configured, strict = true) {
  const wanted = THINKING_LEVELS.includes(configured) ? configured : null
  const declared = typeof profile?.reasoning === 'string' ? profile.reasoning.trim() : ''
  const current = THINKING_LEVELS.includes(declared) ? declared : null
  if (wanted === null || current !== null) return { wanted, current, level: null, blocked: [] }
  const blocked = []
  for (const entry of nextModels) {
    if (supportedThinkingLevels(entry).includes(wanted)) continue
    blocked.push(typeof entry?.id === 'string' ? entry.id.trim() : '')
  }
  return { wanted, current, level: blocked.length === 0 || strict === false ? wanted : null, blocked }
}

/**
 * Read-only view of every provider's default thinking level for the settings panel.
 * @param config - the resolved llm-pi-ai section.
 * @param models - the catalog rows.
 * @param defaults - the plugin's saved defaults.
 * @returns one row per provider that declares models.
 */
export function listProviderReasoning(config, models, defaults = emptyDefaults()) {
  const providers = asRecord(config?.providers)
  if (!providers) return []
  const fallback = parseDefaults(defaults)
  const rows = []
  for (const [key, raw] of Object.entries(providers)) {
    if (!isProviderKey(key)) continue
    const profile = asRecord(raw)
    if (!profile || !Array.isArray(profile.models) || profile.models.length === 0) continue
    const nextModels = profile.models.map((entry) => fillModelEntry(entry, models, fallback).model)
    const plan = planProviderReasoning(profile, nextModels, fallback.providerReasoning, fallback.providerReasoningStrict)
    const displayName = typeof profile.displayName === 'string' && profile.displayName.trim()
      ? profile.displayName.trim()
      : key
    rows.push({
      provider: key,
      displayName,
      wanted: plan.wanted,
      current: plan.current,
      willSet: plan.level !== null,
      blocked: plan.blocked,
    })
  }
  return rows
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
  unmapped: '百科写的档位名 DSH 不认（例如 none / default），没有别的具名档',
  unspecified: '百科只标明会思考，没有写出档位',
})

/** The levels DSH can actually dispatch: off alone declares nothing, so it is not a level set. */
function usableThinkingLevels(value) {
  const levels = sanitizeThinkingLevels(value)
  return levels.some((level) => level !== 'off') ? levels : []
}

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
    const levels = usableThinkingLevels(effortValues)
    return levels.length > 0 ? { levels, gap: null } : { levels: null, gap: 'unmapped' }
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

/**
 * The comparable key of a model id: provider prefix and variant suffix removed.
 *
 * A variant suffix is not a name. Treating it as one made every id ending in
 * ":free" compare on the literal "free" and match whichever catalog row happened
 * to carry that suffix first (a gemma row matched a ling row), which filled the
 * wrong capacities and mislabelled the level-less hits.
 * @param {string} id
 * @returns {string}
 */
function catalogKey(id) {
  const raw = String(id ?? '').trim().toLowerCase()
  if (!raw) return ''
  const tail = raw.split('/').filter(Boolean).pop() ?? raw
  return tail.split(':')[0].trim()
}

export function lookupCatalogModel(models, id) {
  const raw = String(id ?? '').trim().toLowerCase()
  if (!raw) return undefined
  const exact = models.find((item) => item.id.toLowerCase() === raw)
  if (exact) return exact
  const key = catalogKey(raw)
  if (!key) return undefined
  return models.find((item) => catalogKey(item.id) === key)
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
    // A catalog hit that states no discrete level declares nothing, and an
    // off-only level set is invalid DSH config. Both leave the field unset: an
    // empty object would be refused, so drop it and let a missing field stay missing.
    const value = hit && hit.thinkingLevels === null
      ? undefined
      : reasoningEffortsFromLevels(hit ? hit.thinkingLevels : fallback.thinkingLevels)
    if (value === undefined) {
      if (next.reasoningEfforts !== undefined) {
        delete next.reasoningEfforts
        changed = true
      }
    } else {
      next.reasoningEfforts = value
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

/**
 * The exact reasoningEfforts this plugin wrote before 0.2.1 for a catalog hit that
 * states no discrete levels: the invented minimal/low/medium/high. Existing config
 * is never rewritten, so these entries are reported for the user to confirm.
 */
export const LEGACY_FABRICATED_EFFORTS = Object.freeze({
  off: null,
  minimal: 'minimal',
  low: 'low',
  medium: 'medium',
  high: 'high',
})

export const LEGACY_GUESS_NOTE = '这四档是旧版本按「会思考」代填的，百科没有写明档位。档位没错就点「确认保留」，这条会从待确认里消失。不该有这些档位就点「清掉档位」。要改成别的档位，勾好后点「确认档位」。'

export function legacyConfirmKey(provider, id) {
  return `${String(provider ?? '').trim()}\n${String(id ?? '').trim()}`
}

export function parseConfirmedLegacy(raw) {
  if (!Array.isArray(raw)) return []
  const keys = []
  for (const item of raw) {
    if (typeof item === 'string') {
      const splitAt = item.indexOf('\n')
      if (splitAt <= 0 || splitAt === item.length - 1) continue
      keys.push(legacyConfirmKey(item.slice(0, splitAt), item.slice(splitAt + 1)))
      continue
    }
    const record = asRecord(item)
    if (!record) continue
    const provider = typeof record.provider === 'string' ? record.provider.trim() : ''
    const id = typeof record.id === 'string' ? record.id.trim() : ''
    if (provider && id) keys.push(legacyConfirmKey(provider, id))
  }
  return [...new Set(keys)]
}

export function rememberLegacyConfirmation(confirmed, provider, id) {
  const keys = parseConfirmedLegacy(confirmed)
  const key = legacyConfirmKey(provider, id)
  if (key === '\n' || key.startsWith('\n') || key.endsWith('\n')) return keys
  if (!keys.includes(key)) keys.push(key)
  return keys
}

export function isLegacyLevelSelection(levels) {
  return isLegacyFabricatedEfforts(reasoningEffortsFromLevels(levels))
}

export function isLegacyFabricatedEfforts(value) {
  const record = asRecord(value)
  if (!record) return false
  const expected = Object.entries(LEGACY_FABRICATED_EFFORTS)
  if (Object.keys(record).length !== expected.length) return false
  return expected.every(([level, wire]) => record[level] === wire)
}

export function listLegacyThinkingGuesses(config, models, confirmed = []) {
  const accepted = new Set(parseConfirmedLegacy(confirmed))
  const guesses = []
  for (const item of configuredModels(config)) {
    const hit = lookupCatalogModel(models, item.id)
    if (!hit || hit.thinkingLevels !== null) continue
    if (!isLegacyFabricatedEfforts(item.entry.reasoningEfforts)) continue
    if (accepted.has(legacyConfirmKey(item.provider, item.id))) continue
    guesses.push({ ...modelReport(item), note: LEGACY_GUESS_NOTE })
  }
  return guesses
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

export function applyModelPatch(entry, patch, defaults = emptyDefaults(), models = []) {
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
  const mode = typeof patch.thinkingMode === 'string' ? patch.thinkingMode : ''
  if (mode === 'unset') {
    // 保持未声明：也清掉旧版本代填的档位。
    delete next.reasoningEfforts
  } else if (mode === 'none') {
    next.reasoningEfforts = false
  } else if (mode === 'levels') {
    // An explicit level set. Only a set with a level beyond off is a declaration;
    // nothing usable checked leaves the field unset rather than asserting false.
    const levels = Array.isArray(patch.thinkingLevels) ? patch.thinkingLevels : []
    if (levels.some((level) => level !== 'off' && THINKING_LEVELS.includes(level))) {
      next.reasoningEfforts = reasoningEffortsFromLevels(levels)
    } else {
      delete next.reasoningEfforts
    }
  } else if (Array.isArray(patch.thinkingLevels)) {
    next.reasoningEfforts = reasoningEffortsFromLevels(patch.thinkingLevels)
  } else if (missingReasoning(next.reasoningEfforts)) {
    // No explicit choice from the caller. A catalog hit that states no discrete
    // level declares nothing rather than the guessed default level set.
    const hit = lookupCatalogModel(models, id)
    const value = hit && hit.thinkingLevels === null
      ? undefined
      : reasoningEffortsFromLevels(fallback.thinkingLevels)
    if (value === undefined) delete next.reasoningEfforts
    else next.reasoningEfforts = value
  }
  return next
}

export function buildFillOps(config, models, onlyProvider, defaults = emptyDefaults()) {
  const providers = asRecord(config?.providers)
  if (!providers) return { ops: [], filledProviders: [], reasoning: [] }

  const fallback = parseDefaults(defaults)
  const ops = []
  const filledProviders = []
  const reasoning = []
  const keys = typeof onlyProvider === 'string' && onlyProvider ? [onlyProvider] : Object.keys(providers)

  for (const key of keys) {
    if (!isProviderKey(key)) continue
    const profile = asRecord(providers[key])
    if (!profile) continue
    const list = profile.models
    if (!Array.isArray(list) || list.length === 0) continue

    let changed = false
    const nextModels = list.map((entry) => {
      const result = fillModelEntry(entry, models, fallback)
      if (result.changed) changed = true
      return result.model
    })
    if (changed) {
      ops.push({
        op: 'set',
        path: ['providers', key, 'models'],
        value: nextModels,
      })
    }

    const plan = planProviderReasoning(profile, nextModels, fallback.providerReasoning, fallback.providerReasoningStrict)
    if (plan.level !== null) {
      ops.push({
        op: 'set',
        path: ['providers', key, 'reasoning'],
        value: plan.level,
      })
    }
    reasoning.push({ provider: key, ...plan })

    if (changed || plan.level !== null) filledProviders.push(key)
  }

  return { ops, filledProviders, reasoning }
}

export function buildModelSaveOps(config, patch, defaults = emptyDefaults(), models = []) {
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

  const nextModels = list.map((entry, i) => (i === index ? applyModelPatch(entry, patch, defaults, models) : clonePlain(entry)))
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
  // A cache written by an older parser carries stale derived thinking fields, so
  // treat it as stale and let the next start refresh itself instead of asking the
  // user to click 更新. The rows stay usable until that fetch lands.
  const current = record.version === CATALOG_VERSION
  return {
    version: CATALOG_VERSION,
    updatedAt: current && typeof record.updatedAt === 'string' ? record.updatedAt : '',
    autoFill: record.autoFill !== false,
    defaults: parseDefaults(record.defaults),
    models,
    confirmedLegacy: parseConfirmedLegacy(record.confirmedLegacy),
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
