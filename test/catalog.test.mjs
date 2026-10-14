import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_CONTEXT_WINDOW,
  DEFAULT_MAX_TOKENS,
  DEFAULT_REASONING_EFFORTS,
  CATALOG_VERSION,
  applyModelPatch,
  buildFillOps,
  buildModelSaveOps,
  catalogIsStale,
  fillModelEntry,
  formatCatalogStamp,
  isLegacyFabricatedEfforts,
  isLegacyLevelSelection,
  listCatalogConflicts,
  listLegacyThinkingGuesses,
  listProviderReasoning,
  listThinkingGaps,
  listUnmatched,
  lookupCatalogModel,
  parseCatalogFile,
  parseDefaults,
  parseModelsDev,
  reasoningEffortsFromLevels,
  supportedThinkingLevels,
} from '../src/catalog.js'

const SAMPLE = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    models: {
      'gpt-4o': {
        id: 'gpt-4o',
        name: 'GPT-4o',
        limit: { context: 128000, output: 16384 },
        modalities: { input: ['text', 'image'], output: ['text'] },
        reasoning: false,
      },
    },
  },
  zhipuai: {
    id: 'zhipuai',
    name: 'Zhipu AI',
    models: {
      'glm-5.2': {
        id: 'glm-5.2',
        name: 'GLM-5.2',
        limit: { context: 1048576, output: 131072 },
        modalities: { input: ['text'] },
        reasoning: true,
        reasoning_options: [{ type: 'effort', values: ['off', 'low', 'high', 'max'] }],
      },
    },
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    models: {
      'deepseek-chat': {
        id: 'deepseek-chat',
        name: 'DeepSeek Chat',
        limit: { context: 65536, output: 8192 },
        modalities: { input: ['text'] },
        reasoning: true,
      },
    },
  },
}

test('parseModelsDev flattens nested providers', () => {
  const models = parseModelsDev(SAMPLE)
  assert.equal(models.length, 3)
  const gpt = models.find((item) => item.id === 'gpt-4o')
  assert.deepEqual(gpt.input, ['text', 'image'])
  assert.equal(gpt.contextWindow, 128000)
  assert.equal(gpt.maxOutput, 16384)
  assert.deepEqual(gpt.thinkingLevels, [])
})

test('lookup matches exact, prefix, and catalog tail', () => {
  const models = parseModelsDev(SAMPLE)
  assert.equal(lookupCatalogModel(models, 'gpt-4o')?.id, 'gpt-4o')
  assert.equal(lookupCatalogModel(models, 'openai/gpt-4o')?.id, 'gpt-4o')
  assert.equal(lookupCatalogModel(models, 'GLM-5.2')?.id, 'glm-5.2')
})

test('lookup never matches on a variant suffix alone', () => {
  const models = parseModelsDev({
    ...SAMPLE,
    free: {
      id: 'free',
      name: 'Free rows',
      models: {
        'gemma-4-31b-it:free': { id: 'gemma-4-31b-it:free', name: 'Gemma', limit: { context: 1000, output: 100 }, modalities: { input: ['text'] } },
      },
    },
    },
  )
  assert.equal(lookupCatalogModel(models, 'inclusionai/ling-3.1-flash:free'), undefined)
  assert.equal(lookupCatalogModel(models, 'other/thing:free'), undefined)
  assert.equal(lookupCatalogModel(models, 'gemma-4-31b-it:free')?.id, 'gemma-4-31b-it:free')
})

test('reasoningEffortsFromLevels maps DSH wire values', () => {
  assert.equal(reasoningEffortsFromLevels([]), false)
  assert.deepEqual(reasoningEffortsFromLevels(['off', 'low', 'high', 'max']), {
    off: null,
    low: 'low',
    high: 'high',
    max: 'max',
  })
})

test('fillModelEntry writes catalog values for a missing model', () => {
  const models = parseModelsDev(SAMPLE)
  const { model, changed } = fillModelEntry({ id: 'glm-5.2' }, models)
  assert.equal(changed, true)
  assert.equal(model.contextWindow, 1048576)
  assert.equal(model.maxTokens, 131072)
  assert.deepEqual(model.input, ['text'])
  assert.deepEqual(model.reasoningEfforts, {
    off: null,
    low: 'low',
    high: 'high',
    max: 'max',
  })
  assert.equal(model.name, 'GLM-5.2')
})

test('fillModelEntry keeps existing fields', () => {
  const models = parseModelsDev(SAMPLE)
  const { model, changed } = fillModelEntry({
    id: 'glm-5.2',
    name: 'mine',
    contextWindow: 999,
    maxTokens: 111,
    input: ['text', 'image'],
    reasoningEfforts: false,
  }, models)
  assert.equal(changed, false)
  assert.equal(model.contextWindow, 999)
  assert.equal(model.maxTokens, 111)
  assert.deepEqual(model.input, ['text', 'image'])
  assert.equal(model.reasoningEfforts, false)
  assert.equal(model.name, 'mine')
})

test('fillModelEntry uses defaults on catalog miss', () => {
  const { model, changed } = fillModelEntry({ id: 'totally-unknown-x' }, [])
  assert.equal(changed, true)
  assert.equal(model.contextWindow, DEFAULT_CONTEXT_WINDOW)
  assert.equal(model.maxTokens, DEFAULT_MAX_TOKENS)
  assert.deepEqual(model.input, ['text'])
  assert.deepEqual(model.reasoningEfforts, { ...DEFAULT_REASONING_EFFORTS })
})

test('fillModelEntry treats empty reasoningEfforts object as missing', () => {
  const { model, changed } = fillModelEntry({ id: 'totally-unknown-x', reasoningEfforts: {} }, [])
  assert.equal(changed, true)
  assert.deepEqual(model.reasoningEfforts, { ...DEFAULT_REASONING_EFFORTS })
})

test('fillModelEntry sets reasoningEfforts false when catalog has no thinking', () => {
  const models = parseModelsDev(SAMPLE)
  const { model } = fillModelEntry({ id: 'gpt-4o' }, models)
  assert.equal(model.reasoningEfforts, false)
  assert.deepEqual(model.input, ['text', 'image'])
})

test('fillModelEntry leaves reasoning unset when catalog only flags reasoning', () => {
  const models = parseModelsDev(SAMPLE)
  const chat = models.find((item) => item.id === 'deepseek-chat')
  assert.equal(chat.thinkingLevels, null)
  assert.equal(chat.thinkingGap, 'unspecified')
  const { model, changed, matched } = fillModelEntry({ id: 'deepseek-chat' }, models, {
    thinkingLevels: ['off', 'max'],
  })
  assert.equal(matched, true)
  assert.equal(changed, true)
  assert.equal(model.contextWindow, 65536)
  assert.equal(model.maxTokens, 8192)
  assert.equal(Object.hasOwn(model, 'reasoningEfforts'), false)
})

test('fillModelEntry does not rewrite a boolean-only model that already has efforts', () => {
  const models = parseModelsDev(SAMPLE)
  const existing = { off: null, high: 'high' }
  const { model, changed } = fillModelEntry({
    id: 'deepseek-chat',
    name: 'DeepSeek Chat',
    contextWindow: 65536,
    maxTokens: 8192,
    input: ['text'],
    reasoningEfforts: existing,
  }, models)
  assert.equal(changed, false)
  assert.deepEqual(model.reasoningEfforts, existing)
})

test('fillModelEntry drops an empty reasoningEfforts object on a level-less catalog hit', () => {
  const models = parseModelsDev(SAMPLE)
  const { model, changed } = fillModelEntry({
    id: 'deepseek-chat',
    contextWindow: 65536,
    maxTokens: 8192,
    input: ['text'],
    name: 'DeepSeek Chat',
    reasoningEfforts: {},
  }, models)
  assert.equal(changed, true)
  assert.equal(Object.hasOwn(model, 'reasoningEfforts'), false)
})

const SHAPES = {
  lab: {
    id: 'lab',
    name: 'Lab',
    models: {
      'toggle-only': {
        id: 'toggle-only',
        name: 'Toggle Only',
        limit: { context: 1000, output: 100 },
        modalities: { input: ['text'] },
        reasoning: true,
        reasoning_options: [{ type: 'toggle' }],
      },
      'budget-only': {
        id: 'budget-only',
        name: 'Budget Only',
        limit: { context: 2000, output: 200 },
        modalities: { input: ['text'] },
        reasoning: true,
        reasoning_options: [{ type: 'budget_tokens', min: 1024, max: 32000 }],
      },
      'toggle-and-budget': {
        id: 'toggle-and-budget',
        name: 'Toggle And Budget',
        limit: { context: 3000, output: 300 },
        modalities: { input: ['text', 'image'] },
        reasoning: true,
        reasoning_options: [
          { type: 'toggle' },
          { type: 'budget_tokens' },
        ],
      },
      'effort-and-toggle': {
        id: 'effort-and-toggle',
        name: 'Effort And Toggle',
        limit: { context: 4000, output: 400 },
        modalities: { input: ['text'] },
        reasoning: true,
        reasoning_options: [
          { type: 'toggle' },
          { type: 'effort', values: ['high', 'max'] },
        ],
      },
    },
  },
}

test('parseModelsDev does not invent levels for toggle, budget, or boolean reasoning', () => {
  const models = parseModelsDev({ ...SAMPLE, ...SHAPES })
  const byId = (id) => models.find((item) => item.id === id)
  assert.equal(byId('deepseek-chat').thinkingLevels, null)
  assert.equal(byId('deepseek-chat').thinkingGap, 'unspecified')
  assert.equal(byId('toggle-only').thinkingLevels, null)
  assert.equal(byId('toggle-only').thinkingGap, 'toggle')
  assert.equal(byId('budget-only').thinkingLevels, null)
  assert.equal(byId('budget-only').thinkingGap, 'budget')
  assert.equal(byId('toggle-and-budget').thinkingLevels, null)
  assert.equal(byId('toggle-and-budget').thinkingGap, 'toggle-budget')
  assert.deepEqual(byId('effort-and-toggle').thinkingLevels, ['high', 'max'])
  assert.equal(byId('effort-and-toggle').thinkingGap, null)
  assert.deepEqual(byId('glm-5.2').thinkingLevels, ['off', 'low', 'high', 'max'])
  assert.deepEqual(byId('gpt-4o').thinkingLevels, [])
  assert.equal(byId('gpt-4o').thinkingGap, null)
})

test('fillModelEntry leaves toggle and budget models without named efforts', () => {
  const models = parseModelsDev(SHAPES)
  for (const id of ['toggle-only', 'budget-only', 'toggle-and-budget']) {
    const { model, matched } = fillModelEntry({ id }, models, {
      thinkingLevels: ['minimal', 'low', 'medium', 'high'],
    })
    assert.equal(matched, true, id)
    assert.equal(Object.hasOwn(model, 'reasoningEfforts'), false, id)
  }
  const { model } = fillModelEntry({ id: 'effort-and-toggle' }, models)
  assert.deepEqual(model.reasoningEfforts, {
    off: null,
    high: 'high',
    max: 'max',
  })
})

test('listThinkingGaps reports level-less catalog hits and skips declared efforts', () => {
  const models = parseModelsDev({ ...SAMPLE, ...SHAPES })
  const gaps = listThinkingGaps({
    providers: {
      custom: {
        displayName: 'Custom',
        reasoning: 'high',
        models: [
          { id: 'deepseek-chat' },
          { id: 'toggle-only' },
          { id: 'budget-only', reasoningEfforts: { off: null, high: 'high' } },
          { id: 'toggle-and-budget' },
          { id: 'glm-5.2' },
          { id: 'mystery' },
        ],
      },
    },
  }, models)
  assert.deepEqual(gaps.map((item) => item.id), ['deepseek-chat', 'toggle-only', 'toggle-and-budget'])
  assert.equal(gaps[0].thinkingGap, 'unspecified')
  assert.match(gaps[0].note, /没有写出档位/)
  assert.equal(gaps[1].thinkingGap, 'toggle')
  assert.match(gaps[1].note, /思考开关/)
  assert.equal(gaps[2].thinkingGap, 'toggle-budget')
  assert.equal(gaps[0].providerReasoning, 'high')
})

test('buildFillOps fills capacities for a level-less model without inventing efforts', () => {
  const models = parseModelsDev(SAMPLE)
  const filled = buildFillOps({
    providers: { custom: { models: [{ id: 'deepseek-chat' }] } },
  }, models)
  assert.equal(filled.ops.length, 1)
  assert.equal(filled.ops[0].value[0].contextWindow, 65536)
  assert.equal(filled.ops[0].value[0].maxTokens, 8192)
  assert.equal(Object.hasOwn(filled.ops[0].value[0], 'reasoningEfforts'), false)

  const quiet = buildFillOps({
    providers: {
      custom: {
        models: [{
          id: 'deepseek-chat',
          name: 'DeepSeek Chat',
          contextWindow: 65536,
          maxTokens: 8192,
          input: ['text'],
        }],
      },
    },
  }, models)
  assert.deepEqual(quiet.ops, [])
  assert.deepEqual(quiet.filledProviders, [])
})

test('buildFillOps only emits changed provider model lists', () => {
  const models = parseModelsDev(SAMPLE)
  const { ops, filledProviders } = buildFillOps({
    providers: {
      custom: {
        displayName: 'Custom',
        models: [{ id: 'glm-5.2' }, { id: 'keep-me', contextWindow: 1, maxTokens: 1, input: ['text'], reasoningEfforts: false }],
      },
      empty: { models: [] },
      'DeepSeek-Official': { models: [{ id: 'x' }] },
    },
  }, models)
  assert.deepEqual(filledProviders, ['custom'])
  assert.equal(ops.length, 1)
  assert.deepEqual(ops[0].path, ['providers', 'custom', 'models'])
  assert.equal(ops[0].value[0].contextWindow, 1048576)
  assert.equal(ops[0].value[1].contextWindow, 1)
})

test('parseCatalogFile and stale detection', () => {
  const file = parseCatalogFile({ updatedAt: '2020-01-01T00:00:00.000Z', autoFill: false, models: [{ id: 'a' }] })
  assert.equal(file.autoFill, false)
  assert.equal(file.models.length, 1)
  assert.equal(catalogIsStale(file.updatedAt, Date.parse('2020-01-09T00:00:00.000Z')), true)
  assert.equal(catalogIsStale(new Date().toISOString()), false)
})

test('formatCatalogStamp', () => {
  assert.match(formatCatalogStamp('2026-09-06T02:20:57.000Z', 7562), /7562 个模型/)
  assert.equal(formatCatalogStamp('', 0), '尚未更新')
})

test('fillModelEntry uses custom defaults on catalog miss', () => {
  const { model, matched } = fillModelEntry({ id: 'unknown-x' }, [], {
    contextWindow: 111,
    maxTokens: 222,
    image: true,
    thinkingLevels: ['off', 'high'],
  })
  assert.equal(matched, false)
  assert.equal(model.contextWindow, 111)
  assert.equal(model.maxTokens, 222)
  assert.deepEqual(model.input, ['text', 'image'])
  assert.deepEqual(model.reasoningEfforts, { off: null, high: 'high' })
})

test('listUnmatched only returns ids absent from catalog', () => {
  const models = parseModelsDev(SAMPLE)
  const unmatched = listUnmatched({
    providers: {
      custom: {
        displayName: 'Custom',
        reasoning: 'high',
        models: [{ id: 'glm-5.2' }, { id: 'mystery', contextWindow: 9, maxTokens: 8, input: ['text', 'image'] }],
      },
    },
  }, models)
  assert.equal(unmatched.length, 1)
  assert.equal(unmatched[0].id, 'mystery')
  assert.equal(unmatched[0].image, true)
  assert.equal(unmatched[0].providerReasoning, 'high')
  assert.equal(unmatched[0].reasoningOmitted, false)
  const omitted = listUnmatched({
    providers: { custom: { models: [{ id: 'mystery' }] } },
  }, models, ['custom\nmystery'])
  assert.equal(omitted[0].reasoningOmitted, true)
})

test('fillModelEntry leaves reasoning unset when the user chose not to declare it', () => {
  const { model } = fillModelEntry(
    { id: 'totally-unknown-x' },
    [],
    { thinkingLevels: ['off', 'low', 'high'] },
    { omitReasoning: true },
  )
  assert.equal(model.contextWindow, DEFAULT_CONTEXT_WINDOW)
  assert.equal(Object.hasOwn(model, 'reasoningEfforts'), false)
})

test('buildFillOps does not put default thinking levels back on an omitted model', () => {
  const { ops } = buildFillOps(
    { providers: { custom: { models: [{ id: 'unknown-x' }] } } },
    [],
    undefined,
    { thinkingLevels: ['off', 'low', 'high'] },
    ['custom\nunknown-x'],
  )
  const models = ops.find((op) => op.path.at(-1) === 'models')
  assert.equal(Object.hasOwn(models.value[0], 'reasoningEfforts'), false)
})

test('parseDefaults keeps the built-in default level and honours 不改', () => {
  assert.equal(parseDefaults({}).providerReasoning, 'high')
  assert.equal(parseDefaults({ providerReasoning: null }).providerReasoning, null)
  assert.equal(parseDefaults({ providerReasoning: 'low' }).providerReasoning, 'low')
  assert.equal(parseDefaults({ providerReasoning: 'bogus' }).providerReasoning, 'high')
  assert.equal(parseDefaults({}).providerReasoningStrict, true)
  assert.equal(parseDefaults({ providerReasoningStrict: false }).providerReasoningStrict, false)
  assert.equal(parseDefaults({ providerReasoningStrict: 'yes' }).providerReasoningStrict, true)
})

test('buildFillOps can force the level when 严格 is off', () => {
  const entry = { id: 'no-high', contextWindow: 1, maxTokens: 1, input: ['text'], reasoningEfforts: { off: null, low: 'low' } }
  const { ops, reasoning } = buildFillOps({ providers: { custom: { models: [entry] } } }, [], undefined, {
    providerReasoning: 'high',
    providerReasoningStrict: false,
  })
  assert.deepEqual(ops, [{ op: 'set', path: ['providers', 'custom', 'reasoning'], value: 'high' }])
  assert.deepEqual(reasoning, [{ provider: 'custom', wanted: 'high', current: null, level: 'high', blocked: ['no-high'] }])
})

test('supportedThinkingLevels mirrors the adapter resolution', () => {
  assert.deepEqual(supportedThinkingLevels({ reasoningEfforts: false }), ['off'])
  assert.deepEqual(supportedThinkingLevels({ reasoningEfforts: { off: null, low: 'low', high: 'high' } }), ['off', 'low', 'high'])
  assert.deepEqual(supportedThinkingLevels({ reasoningEfforts: { low: 'low', high: 'high', max: 'max' } }), ['low', 'high', 'max'])
  assert.deepEqual(supportedThinkingLevels({ reasoningEfforts: { off: null, low: null } }), ['off'])
  assert.deepEqual(supportedThinkingLevels({}), [])
})

test('buildFillOps writes the provider default level when every model takes it', () => {
  const models = parseModelsDev(SAMPLE)
  const { ops, filledProviders, reasoning } = buildFillOps({
    providers: {
      custom: {
        models: [
          { id: 'glm-5.2' },
          { id: 'listed', contextWindow: 1, maxTokens: 1, input: ['text'], reasoningEfforts: { off: null, high: 'high' } },
        ],
      },
    },
  }, models)
  assert.deepEqual(filledProviders, ['custom'])
  assert.deepEqual(ops.map((op) => op.path.join('.')), ['providers.custom.models', 'providers.custom.reasoning'])
  assert.equal(ops[1].value, 'high')
  assert.deepEqual(reasoning, [{ provider: 'custom', wanted: 'high', current: null, level: 'high', blocked: [] }])
})

test('buildFillOps skips the default level when a model refuses it', () => {
  const entry = { id: 'no-high', contextWindow: 1, maxTokens: 1, input: ['text'], reasoningEfforts: { off: null, low: 'low' } }
  const { ops, filledProviders, reasoning } = buildFillOps({ providers: { custom: { models: [entry] } } }, [], undefined, { providerReasoning: 'high' })
  assert.deepEqual(ops, [])
  assert.deepEqual(filledProviders, [])
  assert.deepEqual(reasoning, [{ provider: 'custom', wanted: 'high', current: null, level: null, blocked: ['no-high'] }])
})

test('buildFillOps leaves an already set provider level alone', () => {
  const entry = { id: 'm', contextWindow: 1, maxTokens: 1, input: ['text'], reasoningEfforts: { off: null, high: 'high' } }
  const { ops, reasoning } = buildFillOps({ providers: { custom: { reasoning: 'low', models: [entry] } } }, [], undefined, { providerReasoning: 'high' })
  assert.deepEqual(ops, [])
  assert.deepEqual(reasoning, [{ provider: 'custom', wanted: 'high', current: 'low', level: null, blocked: [] }])
})

test('buildFillOps writes no level when the default is 不改', () => {
  const entry = { id: 'm', contextWindow: 1, maxTokens: 1, input: ['text'], reasoningEfforts: { off: null, high: 'high' } }
  const { ops, reasoning } = buildFillOps({ providers: { custom: { models: [entry] } } }, [], undefined, { providerReasoning: null })
  assert.deepEqual(ops, [])
  assert.deepEqual(reasoning, [{ provider: 'custom', wanted: null, current: null, level: null, blocked: [] }])
})

test('buildFillOps can set the off default for a non-reasoning provider', () => {
  const entry = { id: 'm', contextWindow: 1, maxTokens: 1, input: ['text'], reasoningEfforts: false }
  const { ops, reasoning } = buildFillOps({ providers: { custom: { models: [entry] } } }, [], undefined, { providerReasoning: 'off' })
  assert.deepEqual(ops, [{ op: 'set', path: ['providers', 'custom', 'reasoning'], value: 'off' }])
  assert.equal(reasoning[0].level, 'off')
})

test('listProviderReasoning reports every provider that declares models', () => {
  const models = parseModelsDev(SAMPLE)
  const rows = listProviderReasoning({
    providers: {
      custom: { displayName: 'Custom', models: [{ id: 'glm-5.2' }] },
      unsupported: { models: [{ id: 'u', contextWindow: 1, maxTokens: 1, input: ['text'], reasoningEfforts: { low: 'low' } }] },
      empty: { models: [] },
    },
  }, models)
  assert.deepEqual(rows.map((row) => row.provider), ['custom', 'unsupported'])
  assert.equal(rows[0].displayName, 'Custom')
  assert.equal(rows[0].willSet, true)
  assert.equal(rows[0].wanted, 'high')
  assert.equal(rows[1].willSet, false)
  assert.deepEqual(rows[1].blocked, ['u'])
})

test('parseDefaults sanitizes unknown fields', () => {
  const defaults = parseDefaults({
    contextWindow: 10,
    maxTokens: 20,
    image: true,
    thinkingLevels: ['nope', 'max'],
    providerReasoning: 'max',
  })
  assert.equal(defaults.contextWindow, 10)
  assert.deepEqual(defaults.thinkingLevels, ['max'])
  assert.equal(defaults.providerReasoning, 'max')
})

const LEVEL_LESS = {
  lab: {
    id: 'lab',
    name: 'Lab',
    models: {
      'switch-only': {
        id: 'switch-only',
        name: 'Switch Only',
        limit: { context: 1000, output: 100 },
        modalities: { input: ['text'] },
        reasoning: true,
        reasoning_options: [{ type: 'toggle' }],
      },
      'odd-names': {
        id: 'odd-names',
        name: 'Odd Names',
        limit: { context: 1000, output: 100 },
        modalities: { input: ['text'] },
        reasoning: true,
        reasoning_options: [{ type: 'effort', values: ['none', 'default'] }],
      },
      'off-only': {
        id: 'off-only',
        name: 'Off Only',
        limit: { context: 1000, output: 100 },
        modalities: { input: ['text'] },
        reasoning: true,
        reasoning_options: [{ type: 'effort', values: ['off'] }],
      },
      'off-and-high': {
        id: 'off-and-high',
        name: 'Off And High',
        limit: { context: 1000, output: 100 },
        modalities: { input: ['text'] },
        reasoning: true,
        reasoning_options: [{ type: 'effort', values: ['off', 'high'] }],
      },
    },
  },
}

test('thinkingFromEntry reports effort values DSH cannot dispatch as a gap', () => {
  const parsed = parseModelsDev(LEVEL_LESS)
  const byId = (id) => parsed.find((item) => item.id === id)
  for (const id of ['odd-names', 'off-only']) {
    assert.equal(byId(id).thinkingLevels, null, id)
    assert.equal(byId(id).thinkingGap, 'unmapped', id)
  }
  assert.deepEqual(byId('off-and-high').thinkingLevels, ['off', 'high'])
  assert.equal(byId('off-and-high').thinkingGap, null)
})

test('fillModelEntry leaves the field unset for an unmappable level set', () => {
  const models = parseModelsDev(LEVEL_LESS)
  for (const id of ['switch-only', 'odd-names', 'off-only']) {
    const { model, matched } = fillModelEntry({ id }, models, { thinkingLevels: ['off', 'low', 'high'] })
    assert.equal(matched, true, id)
    assert.equal(Object.hasOwn(model, 'reasoningEfforts'), false, id)
  }
})

test('fillModelEntry maps an off-only default to false, never to an off-only dict', () => {
  const { model } = fillModelEntry({ id: 'unlisted' }, [], { thinkingLevels: ['off'] })
  assert.equal(model.reasoningEfforts, false)
})

test('parseCatalogFile treats an older cache version as stale', () => {
  const fresh = parseCatalogFile({ version: CATALOG_VERSION, updatedAt: '2026-01-01T00:00:00.000Z', models: [] })
  assert.equal(fresh.updatedAt, '2026-01-01T00:00:00.000Z')
  const old = parseCatalogFile({ version: 1, updatedAt: '2026-01-01T00:00:00.000Z', models: [] })
  assert.equal(old.updatedAt, '')
  assert.equal(old.version, CATALOG_VERSION)
  assert.equal(catalogIsStale(old.updatedAt, Date.parse('2026-01-02T00:00:00.000Z')), true)
})

test('isLegacyFabricatedEfforts matches only the invented four levels', () => {
  assert.equal(isLegacyFabricatedEfforts({ off: null, minimal: 'minimal', low: 'low', medium: 'medium', high: 'high' }), true)
  assert.equal(isLegacyFabricatedEfforts({ off: null, low: 'low', medium: 'medium', high: 'high' }), false)
  assert.equal(isLegacyFabricatedEfforts({ off: null, minimal: 'minimal', low: 'low', medium: 'medium', high: 'xhigh' }), false)
  assert.equal(isLegacyFabricatedEfforts(false), false)
  assert.equal(isLegacyFabricatedEfforts({ off: null, minimal: 'minimal', low: 'low', medium: 'medium', high: 'high', max: 'max' }), false)
})

test('listLegacyThinkingGuesses reports the 0.2.0 fabrication on level-less hits only', () => {
  const models = parseModelsDev(LEVEL_LESS)
  const fabricated = { off: null, minimal: 'minimal', low: 'low', medium: 'medium', high: 'high' }
  const config = {
    providers: {
      custom: {
        displayName: 'Custom',
        models: [
          { id: 'switch-only', reasoningEfforts: { ...fabricated } },
          { id: 'off-and-high', reasoningEfforts: { ...fabricated } },
          { id: 'switch-only-2', reasoningEfforts: { off: null, high: 'high' } },
        ],
      },
    },
  }
  const guesses = listLegacyThinkingGuesses(config, models)
  assert.deepEqual(guesses.map((item) => item.id), ['switch-only'])
  assert.equal(guesses[0].provider, 'custom')
  assert.equal(typeof guesses[0].note, 'string')
  assert.equal(guesses[0].note.length > 0, true)
  const accepted = listLegacyThinkingGuesses(config, models, ['custom\nswitch-only'])
  assert.deepEqual(accepted, [])
})

test('isLegacyLevelSelection matches the invented four levels', () => {
  assert.equal(isLegacyLevelSelection(['off', 'minimal', 'low', 'medium', 'high']), true)
  assert.equal(isLegacyLevelSelection(['low', 'high']), false)
})

test('parseCatalogFile keeps confirmed legacy rows', () => {
  const file = parseCatalogFile({
    confirmedLegacy: [{ provider: 'custom', id: 'switch-only' }, { provider: 'custom', id: 'switch-only' }],
  })
  assert.deepEqual(file.confirmedLegacy, ['custom\nswitch-only'])
})

test('applyModelPatch honours an explicit thinking mode', () => {
  const models = parseModelsDev(LEVEL_LESS)
  const entry = {
    id: 'switch-only',
    contextWindow: 1,
    maxTokens: 1,
    input: ['text'],
    reasoningEfforts: { off: null, minimal: 'minimal', low: 'low', medium: 'medium', high: 'high' },
  }
  const kept = applyModelPatch(entry, { thinkingMode: 'unset' }, undefined, models)
  assert.equal(Object.hasOwn(kept, 'reasoningEfforts'), false)
  const none = applyModelPatch(entry, { thinkingMode: 'none' }, undefined, models)
  assert.equal(none.reasoningEfforts, false)
  const levels = applyModelPatch(entry, { thinkingMode: 'levels', thinkingLevels: ['low', 'high'] }, undefined, models)
  assert.deepEqual(levels.reasoningEfforts, { off: null, low: 'low', high: 'high' })
  const emptied = applyModelPatch(entry, { thinkingMode: 'levels', thinkingLevels: [] }, undefined, models)
  assert.equal(Object.hasOwn(emptied, 'reasoningEfforts'), false)
  const offOnly = applyModelPatch(entry, { thinkingMode: 'levels', thinkingLevels: ['off'] }, undefined, models)
  assert.equal(Object.hasOwn(offOnly, 'reasoningEfforts'), false)
})

test('applyModelPatch does not invent levels for a level-less catalog hit', () => {
  const models = parseModelsDev(LEVEL_LESS)
  const patched = applyModelPatch({ id: 'switch-only' }, {}, { thinkingLevels: ['off', 'low', 'high'] }, models)
  assert.equal(Object.hasOwn(patched, 'reasoningEfforts'), false)
  const unmatched = applyModelPatch({ id: 'not-in-catalog' }, {}, { thinkingLevels: ['off', 'low', 'high'] }, models)
  assert.deepEqual(unmatched.reasoningEfforts, { off: null, low: 'low', high: 'high' })
})

const SPLIT = {
  alpha: {
    id: 'alpha',
    name: 'Alpha',
    models: {
      'glm-5.2': {
        id: 'glm-5.2',
        name: 'GLM-5.2',
        limit: { context: 1000000, output: 131072 },
        modalities: { input: ['text'] },
        reasoning: true,
        reasoning_options: [{ type: 'effort', values: ['low', 'high'] }],
      },
    },
  },
  beta: {
    id: 'beta',
    name: 'Beta',
    models: {
      'glm-5.2': {
        id: 'glm-5.2',
        name: 'GLM-5.2',
        limit: { context: 1048576, output: 131072 },
        modalities: { input: ['text'] },
        reasoning: true,
        reasoning_options: [{ type: 'effort', values: ['low', 'max'] }],
      },
    },
  },
}

test('lookup does not copy the first row when same-id copies disagree', () => {
  const models = parseModelsDev(SPLIT)
  const hit = lookupCatalogModel(models, 'gateway/glm-5.2')
  assert.equal(hit.ambiguous, true)
  assert.equal(hit.candidateCount, 2)
  assert.equal(hit.contextWindow, null)
  assert.equal(hit.maxOutput, 131072)
  assert.equal(hit.thinkingLevels, null)
  assert.equal(hit.conflicts.context, true)
  assert.equal(hit.conflicts.output, false)
  assert.equal(hit.conflicts.thinking, true)
})

test('fill skips disagreeing catalog fields and keeps the ones every copy shares', () => {
  const models = parseModelsDev(SPLIT)
  const { model, changed, matched } = fillModelEntry({ id: 'glm-5.2' }, models, {
    contextWindow: 111,
    maxTokens: 222,
    thinkingLevels: ['off', 'high'],
  })
  assert.equal(matched, true)
  assert.equal(changed, true)
  assert.equal(model.contextWindow, undefined)
  assert.equal(model.maxTokens, 131072)
  assert.equal(Object.hasOwn(model, 'reasoningEfforts'), false)
})

test('lookup returns one row when every copy agrees', () => {
  const same = structuredClone(SPLIT)
  same.beta.models['glm-5.2'].limit.context = 1000000
  same.beta.models['glm-5.2'].reasoning_options = [{ type: 'effort', values: ['low', 'high'] }]
  const models = parseModelsDev(same)
  const hit = lookupCatalogModel(models, 'glm-5.2')
  assert.equal(hit.ambiguous, undefined)
  assert.equal(hit.contextWindow, 1000000)
  const { model } = fillModelEntry({ id: 'glm-5.2' }, models)
  assert.equal(model.contextWindow, 1000000)
  assert.deepEqual(model.reasoningEfforts, { off: null, low: 'low', high: 'high' })
})

test('listCatalogConflicts only lists models that still lack a disagreeing field', () => {
  const models = parseModelsDev(SPLIT)
  const config = {
    providers: {
      custom: {
        displayName: 'Custom',
        models: [
          { id: 'glm-5.2' },
          {
            id: 'glm-5.2',
            contextWindow: 1048576,
            maxTokens: 131072,
            input: ['text'],
            reasoningEfforts: { off: null, low: 'low' },
          },
        ],
      },
    },
  }
  const rows = listCatalogConflicts(config, models)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].id, 'glm-5.2')
  assert.match(rows[0].note, /上下文/)
  assert.match(rows[0].note, /思考档位/)
  assert.equal(listThinkingGaps(config, models).some((item) => item.id === 'glm-5.2'), false)
})

test('listUnmatched tells false apart from a missing reasoning field', () => {
  const rows = listUnmatched({
    providers: {
      custom: {
        models: [
          { id: 'silent', reasoningEfforts: false },
          { id: 'blank' },
        ],
      },
    },
  }, [])
  assert.equal(rows.find((item) => item.id === 'silent').reasoningNone, true)
  assert.equal(rows.find((item) => item.id === 'blank').reasoningNone, false)
})

test('applyModelPatch does not turn a cleared number into the default', () => {
  const kept = applyModelPatch(
    { id: 'kept', contextWindow: 1000, maxTokens: 50 },
    { contextWindow: 0, maxTokens: null },
  )
  assert.equal(kept.contextWindow, 1000)
  assert.equal(kept.maxTokens, 50)
  const cleared = applyModelPatch({ id: 'empty' }, { contextWindow: 0, maxTokens: 0 })
  assert.equal(cleared.contextWindow, undefined)
  assert.equal(cleared.maxTokens, undefined)
  const omitted = applyModelPatch({ id: 'empty' }, {})
  assert.equal(omitted.contextWindow, DEFAULT_CONTEXT_WINDOW)
  assert.equal(omitted.maxTokens, DEFAULT_MAX_TOKENS)
})

test('buildModelSaveOps ignores a provider default the model does not offer', () => {
  const config = {
    providers: {
      custom: {
        reasoning: 'low',
        models: [{
          id: 'm',
          contextWindow: 10,
          maxTokens: 10,
          input: ['text'],
          reasoningEfforts: { off: null, low: 'low', high: 'high' },
        }],
      },
    },
  }
  const dropped = buildModelSaveOps(config, {
    provider: 'custom',
    id: 'm',
    contextWindow: 10,
    maxTokens: 10,
    image: false,
    thinkingMode: 'levels',
    thinkingLevels: ['off', 'low'],
    providerReasoning: 'high',
  })
  assert.equal(dropped.some((op) => op.path.at(-1) === 'reasoning'), false)
  assert.deepEqual(dropped[0].value[0].reasoningEfforts, { off: null, low: 'low' })
  const kept = buildModelSaveOps(config, {
    provider: 'custom',
    id: 'm',
    contextWindow: 10,
    maxTokens: 10,
    image: false,
    thinkingMode: 'levels',
    thinkingLevels: ['off', 'low', 'high'],
    providerReasoning: 'high',
  })
  assert.equal(kept.find((op) => op.path.at(-1) === 'reasoning').value, 'high')
})

test('buildModelSaveOps clears a provider default the model no longer accepts', () => {
  const config = {
    providers: {
      vcnovbgemini: {
        reasoning: 'high',
        models: [{
          id: 'gemini-4-argon-high',
          contextWindow: 1000000,
          maxTokens: 128000,
          input: ['text', 'image'],
        }],
      },
    },
  }
  const patch = {
    provider: 'vcnovbgemini',
    id: 'gemini-4-argon-high',
    contextWindow: 1000000,
    maxTokens: 128000,
    image: true,
    providerReasoning: null,
  }
  const unset = buildModelSaveOps(config, { ...patch, thinkingMode: 'unset' })
  assert.deepEqual(unset.find((op) => op.path.at(-1) === 'reasoning'), {
    op: 'unset',
    path: ['providers', 'vcnovbgemini', 'reasoning'],
  })
  const none = buildModelSaveOps(config, { ...patch, thinkingMode: 'none' })
  assert.equal(none.find((op) => op.path.at(-1) === 'reasoning').op, 'unset')
  const still = buildModelSaveOps(config, {
    ...patch,
    thinkingMode: 'levels',
    thinkingLevels: ['off', 'low', 'high'],
  })
  assert.equal(still.some((op) => op.op === 'unset'), false)
})

