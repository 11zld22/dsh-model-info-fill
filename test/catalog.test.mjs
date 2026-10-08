import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_CONTEXT_WINDOW,
  DEFAULT_MAX_TOKENS,
  DEFAULT_REASONING_EFFORTS,
  buildFillOps,
  catalogIsStale,
  fillModelEntry,
  formatCatalogStamp,
  listThinkingGaps,
  listUnmatched,
  lookupCatalogModel,
  parseCatalogFile,
  parseDefaults,
  parseModelsDev,
  reasoningEffortsFromLevels,
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
