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
  lookupCatalogModel,
  parseCatalogFile,
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

test('fillModelEntry uses default thinking levels when catalog only flags reasoning', () => {
  const models = parseModelsDev(SAMPLE)
  const { model } = fillModelEntry({ id: 'deepseek-chat' }, models)
  assert.deepEqual(model.reasoningEfforts, {
    off: null,
    minimal: 'minimal',
    low: 'low',
    medium: 'medium',
    high: 'high',
  })
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
