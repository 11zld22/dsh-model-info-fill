window.__ModuleLoader__.load({
  id: 'dsh-model-info-fill',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const react = require('react')
    const h = react.createElement
    const { useCallback, useEffect, useLayoutEffect, useRef, useState } = react

    const PREFIX = '/plugins/models-dev-catalog'
    const STYLE_ID = 'dsh-model-info-fill'
    const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']

    const CSS = `
.mdc-wrap { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.mdc-row {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
  width: 100%;
  padding: 12px;
  border: .5px solid var(--dsw-alias-border-l4, rgba(127,127,127,.2));
  border-radius: 16px;
  background: transparent;
  color: var(--dsw-alias-label-primary, inherit);
  box-sizing: border-box;
}
.mdc-head {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 200px;
}
.mdc-icon {
  flex: none;
  width: 18px;
  height: 18px;
  color: var(--dsw-alias-label-secondary, #888);
}
.mdc-body { flex: 1; min-width: 0; }
.mdc-title {
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
}
.mdc-meta {
  margin-top: 2px;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-secondary, #666);
}
.mdc-desc {
  margin-top: 2px;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary, #888);
}
.mdc-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}
.mdc-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.mdc-chip {
  box-sizing: border-box;
  height: 28px;
  padding: 0 10px;
  border: .5px solid var(--dsw-alias-border-l3, rgba(127,127,127,.3));
  border-radius: 14px;
  background: transparent;
  color: var(--dsw-alias-label-primary, inherit);
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
}
.mdc-chip:hover {
  background: var(--dsw-alias-interactive-bg-hover-solid, rgba(127,127,127,.12));
}
.mdc-chip:focus-visible {
  box-shadow: 0 0 0 2px var(--dsw-alias-border-l3, rgba(127,127,127,.35));
  outline: none;
}
.mdc-chip-warn {
  color: var(--dsw-alias-state-warning-primary, #9a3412);
  border-color: color-mix(in srgb, var(--dsw-alias-state-warning-primary, #9a3412) 45%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-warning-primary, #c2410c) 10%, transparent);
}
.mdc-chip-on {
  background: var(--dsw-alias-interactive-bg-hover-solid, rgba(127,127,127,.16));
  border-color: var(--dsw-alias-label-secondary, #666);
}
.mdc-chip-warn.mdc-chip-on {
  background: color-mix(in srgb, var(--dsw-alias-state-warning-primary, #c2410c) 18%, transparent);
  border-color: var(--dsw-alias-state-warning-primary, #9a3412);
}
.mdc-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
  margin-left: auto;
  max-width: 100%;
}
.mdc-btn {
  box-sizing: border-box;
  height: 36px;
  font: inherit;
  cursor: pointer;
  border: .5px solid var(--dsw-alias-border-l3, rgba(127,127,127,.3));
  border-radius: 18px;
  justify-content: center;
  align-items: center;
  padding: 0 14px;
  font-size: 14px;
  line-height: 22px;
  display: inline-flex;
  color: var(--dsw-alias-label-primary, inherit);
  background: transparent;
}
.mdc-btn:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover-solid, rgba(127,127,127,.12));
}
.mdc-btn:focus-visible {
  box-shadow: 0 0 0 2px var(--dsw-alias-border-l3, rgba(127,127,127,.35));
  outline: none;
}
.mdc-btn[disabled] { opacity: .4; cursor: default; }
.mdc-btn-primary {
  border-color: transparent;
  background: var(--dsw-alias-button-primary-fill, #3b82f6);
  color: var(--dsw-alias-label-primary-foreground, #fff);
}
.mdc-btn-primary:hover:not(:disabled) {
  background: var(--dsw-alias-button-primary-hover, #2563eb);
}
.mdc-btn-inline {
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
  line-height: 18px;
  border-radius: 14px;
}
.mdc-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--dsw-alias-label-secondary, #888);
  user-select: none;
  cursor: pointer;
}
.mdc-card { display: contents; }
.mdc-error { color: var(--dsw-alias-state-error-primary, #ef4444); }
.mdc-ok { color: var(--dsw-alias-state-success-primary, #16a34a); }
.mdc-panel {
  border: .5px solid var(--dsw-alias-border-l4, rgba(127,127,127,.2));
  border-radius: 16px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.mdc-block-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--dsw-alias-label-secondary, #888);
}
.mdc-grid {
  display: grid;
  grid-template-columns: 88px 1fr 88px 1fr;
  gap: 8px 10px;
  align-items: center;
}
.mdc-label { font-size: 12px; color: var(--dsw-alias-label-secondary, #888); }
.mdc-input, .mdc-select {
  box-sizing: border-box;
  width: 100%;
  height: 32px;
  border: .5px solid var(--dsw-alias-border-l3, rgba(127,127,127,.3));
  border-radius: 8px;
  background: transparent;
  color: inherit;
  padding: 0 8px;
  font: inherit;
  font-size: 12px;
}
.mdc-levels {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
}
.mdc-item {
  border: .5px solid var(--dsw-alias-border-l4, rgba(127,127,127,.2));
  border-radius: 12px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.mdc-item-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.mdc-item-id { font-size: 13px; font-weight: 500; }
.mdc-item-sub { font-size: 12px; color: var(--dsw-alias-label-tertiary, #888); }
`

    function pad(value) {
      return String(value).padStart(2, '0')
    }

    function formatStamp(updatedAt, count) {
      if (!updatedAt) return count ? `${count} 个模型` : '尚未更新'
      const date = new Date(updatedAt)
      if (Number.isNaN(date.getTime())) return count ? `${count} 个模型` : '尚未更新'
      return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} · ${count} 个模型`
    }

    function reasoningRowText(row) {
      if (row.current) return `已设 ${row.current}`
      if (!row.wanted) return '不改'
      const refused = row.blocked.length > 0 ? `（${row.blocked.join('、')} 不支持）` : ''
      if (row.willSet) return `补全时设为 ${row.wanted}${refused}`
      return `${row.wanted} 没写：${row.blocked.join('、')} 不支持`
    }

    function fillHint(result) {
      const rows = Array.isArray(result?.reasoning) ? result.reasoning : []
      const set = rows.filter((row) => row.level).length
      const parts = []
      if (result?.filled) parts.push(`已补全 ${result.filled} 个供应商`)
      if (set) parts.push(`默认档位 +${set}`)
      return parts.length > 0 ? parts.join(' · ') : '没有缺失字段'
    }

    async function api(path, options) {
      const response = await fetch(PREFIX + path, {
        credentials: 'same-origin',
        ...options,
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || `HTTP ${response.status}`)
      }
      return data
    }

    function post(path, body) {
      return api(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      })
    }

    function isEditButton(button) {
      const text = button.textContent.replace(/\s+/g, '')
      return text === '编辑' || text === 'Edit'
    }

    function isRemoveButton(button) {
      const text = button.textContent.replace(/\s+/g, '')
      return text === '删除' || text === 'Delete' || text === 'Remove'
    }

    function RefreshIcon() {
      return h('svg', {
        className: 'mdc-icon',
        viewBox: '0 0 20 20',
        width: 18,
        height: 18,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.6,
        'aria-hidden': true,
      }, h('path', { d: 'M4 10a6 6 0 0 1 10.4-4.1L16 4v5h-5l1.7-1.7A4.2 4.2 0 1 0 14.2 13' }))
    }

    function LevelChecks({ value, onChange }) {
      const selected = Array.isArray(value) ? value : []
      return h('div', { className: 'mdc-levels' },
        THINKING_LEVELS.map((level) => h('label', { key: level, className: 'mdc-toggle' },
          h('input', {
            type: 'checkbox',
            checked: selected.includes(level),
            onChange: (event) => {
              const next = event.target.checked
                ? THINKING_LEVELS.filter((item) => item === level || selected.includes(item))
                : selected.filter((item) => item !== level)
              onChange(next)
            },
          }),
          level,
        )),
      )
    }

    function DefaultsForm({ defaults, busy, onSave }) {
      const [draft, setDraft] = useState(defaults)
      useEffect(() => { setDraft(defaults) }, [defaults])
      if (!draft) return null
      const defaultsLevels = Array.isArray(draft.thinkingLevels) ? draft.thinkingLevels : []
      const offOnly = defaultsLevels.length > 0 && defaultsLevels.every((level) => level === 'off')
      return h('div', { className: 'mdc-item' },
        h('div', { className: 'mdc-block-title' }, '未匹配时的默认值'),
        h('div', { className: 'mdc-grid' },
          h('div', { className: 'mdc-label' }, '上下文'),
          h('input', {
            className: 'mdc-input',
            type: 'number',
            min: 1,
            value: draft.contextWindow ?? '',
            onChange: (event) => setDraft({ ...draft, contextWindow: Number(event.target.value) }),
          }),
          h('div', { className: 'mdc-label' }, 'maxTokens'),
          h('input', {
            className: 'mdc-input',
            type: 'number',
            min: 1,
            value: draft.maxTokens ?? '',
            onChange: (event) => setDraft({ ...draft, maxTokens: Number(event.target.value) }),
          }),
        ),
        h('label', { className: 'mdc-toggle' },
          h('input', {
            type: 'checkbox',
            checked: draft.image === true,
            onChange: (event) => setDraft({ ...draft, image: event.target.checked }),
          }),
          '支持图片',
        ),
        h('div', { className: 'mdc-label' }, '思考强度'),
        h(LevelChecks, {
          value: draft.thinkingLevels,
          onChange: (thinkingLevels) => setDraft({ ...draft, thinkingLevels }),
        }),
        offOnly ? h('div', { className: 'mdc-desc' },
          '只勾 off 等于「不会思考」：DSH 没有「只能关思考、不能开」的写法，所以这样会写成 false。',
        ) : null,
        h('div', { className: 'mdc-grid' },
          h('div', { className: 'mdc-label' }, '默认档位'),
          h('select', {
            className: 'mdc-select',
            value: draft.providerReasoning || '',
            onChange: (event) => setDraft({ ...draft, providerReasoning: event.target.value || null }),
          },
            h('option', { value: '' }, '不改'),
            THINKING_LEVELS.map((level) => h('option', { key: level, value: level }, level)),
          ),
        ),
        h('label', { className: 'mdc-toggle' },
          h('input', {
            type: 'checkbox',
            checked: draft.providerReasoningStrict !== false,
            onChange: (event) => setDraft({ ...draft, providerReasoningStrict: event.target.checked }),
          }),
          '严格：模型不支持就不写',
        ),
        h('div', { className: 'mdc-desc' },
          '默认档位写进供应商的 reasoning —— 该供应商新对话的默认思考强度。供应商下各模型的档位经常不一致，而写进去的档位会被每个模型拿来用，模型不支持就直接报错；所以默认只在全部模型都支持时才写（想强行写就取消勾选「严格」）。',
        ),
        h('div', { className: 'mdc-actions' },
          h('button', {
            className: 'mdc-btn mdc-btn-inline',
            type: 'button',
            disabled: busy,
            onClick: () => onSave(draft),
          }, busy ? '保存中…' : '保存默认'),
        ),
      )
    }

    function UnmatchedRow({ item, kind, fallbackLevels, busy, onSave }) {
      const declared = Array.isArray(item.thinkingLevels) && item.thinkingLevels.length > 0
      const fallback = Array.isArray(fallbackLevels) ? fallbackLevels : []
      // 未匹配百科的模型沿用「未匹配默认值」的档位；百科命中但没写档位的模型不预勾任何档位。
      const initial = {
        ...item,
        thinkingLevels: declared ? item.thinkingLevels : kind === 'unmatched' ? fallback : [],
        thinkingMode: kind === 'unmatched' || declared ? 'levels' : 'unset',
      }
      const [draft, setDraft] = useState(initial)
      const [error, setError] = useState('')
      useEffect(() => { setDraft(initial); setError('') }, [item, kind, fallbackLevels])
      const levels = Array.isArray(draft.thinkingLevels) ? draft.thinkingLevels : []
      const thinking = levels.filter((level) => level !== 'off')
      const mode = draft.thinkingMode === 'levels' || draft.thinkingMode === 'none' || draft.thinkingMode === 'unset'
        ? draft.thinkingMode
        : 'unset'
      const save = () => {
        if (mode === 'levels' && thinking.length === 0) {
          setError('「指定档位」至少要勾一个 off 以外的档位；只声明不会思考请选「不会思考」。')
          return
        }
        setError('')
        onSave({ ...draft, thinkingMode: mode })
      }
      const keepingLegacy = kind === 'legacy' && mode === 'levels' && isLegacyLevelSet(levels)
      const confirmLabel = mode === 'none'
        ? '确认不会思考'
        : mode === 'unset'
          ? '确认清掉'
          : keepingLegacy
            ? '确认保留'
            : '确认档位'
      const confirm = () => {
        if (mode === 'levels' && thinking.length === 0) {
          setError('「指定档位」至少要勾一个 off 以外的档位；只声明不会思考请选「不会思考」。')
          return
        }
        setError('')
        onSave({ ...draft, thinkingMode: mode, confirmLegacy: keepingLegacy })
      }
      const clearLegacy = () => {
        setError('')
        onSave({ ...draft, thinkingMode: 'unset' })
      }
      return h('div', { className: 'mdc-item' },
        h('div', { className: 'mdc-item-head' },
          h('div', { className: 'mdc-item-id' }, draft.id),
          h('div', { className: 'mdc-item-sub' }, `${draft.displayName} · ${draft.provider}`),
        ),
        draft.note ? h('div', { className: 'mdc-desc' }, draft.note) : null,
        h('div', { className: 'mdc-grid' },
          h('div', { className: 'mdc-label' }, '上下文'),
          h('input', {
            className: 'mdc-input',
            type: 'number',
            min: 1,
            value: draft.contextWindow ?? '',
            onChange: (event) => setDraft({ ...draft, contextWindow: Number(event.target.value) }),
          }),
          h('div', { className: 'mdc-label' }, 'maxTokens'),
          h('input', {
            className: 'mdc-input',
            type: 'number',
            min: 1,
            value: draft.maxTokens ?? '',
            onChange: (event) => setDraft({ ...draft, maxTokens: Number(event.target.value) }),
          }),
        ),
        h('label', { className: 'mdc-toggle' },
          h('input', {
            type: 'checkbox',
            checked: draft.image === true,
            onChange: (event) => setDraft({ ...draft, image: event.target.checked }),
          }),
          '支持图片',
        ),
        h('div', { className: 'mdc-grid' },
          h('div', { className: 'mdc-label' }, '思考档位'),
          h('select', {
            className: 'mdc-select',
            value: mode,
            onChange: (event) => setDraft({ ...draft, thinkingMode: event.target.value }),
          },
            h('option', { value: 'unset' }, '保持未声明（不写字段）'),
            h('option', { value: 'none' }, '不会思考（false）'),
            h('option', { value: 'levels' }, '指定档位'),
          ),
        ),
        mode === 'levels' ? h(LevelChecks, {
          value: levels,
          onChange: (thinkingLevels) => setDraft({ ...draft, thinkingLevels }),
        }) : null,
        h('div', { className: 'mdc-grid' },
          h('div', { className: 'mdc-label' }, '默认档位'),
          h('select', {
            className: 'mdc-select',
            value: draft.providerReasoning || '',
            onChange: (event) => setDraft({ ...draft, providerReasoning: event.target.value || null }),
          },
            h('option', { value: '' }, '不改'),
            thinking.map((level) => h('option', { key: level, value: level }, level)),
          ),
        ),
        error ? h('div', { className: 'mdc-desc mdc-error' }, error) : null,
        h('div', { className: 'mdc-actions' },
          kind === 'legacy' && mode !== 'unset' ? h('button', {
            className: 'mdc-btn mdc-btn-inline',
            type: 'button',
            disabled: busy,
            onClick: clearLegacy,
          }, busy ? '处理中…' : '清掉档位') : null,
          h('button', {
            className: kind === 'legacy' ? 'mdc-btn mdc-btn-inline mdc-btn-primary' : 'mdc-btn mdc-btn-inline',
            type: 'button',
            disabled: busy,
            onClick: kind === 'legacy' ? confirm : save,
          }, busy ? '处理中…' : kind === 'legacy' ? confirmLabel : '保存'),
        ),
      )
    }

    const LEGACY_LEVELS = ['off', 'minimal', 'low', 'medium', 'high']

    function isLegacyLevelSet(levels) {
      const selected = Array.isArray(levels) ? levels : []
      return LEGACY_LEVELS.every((level) => selected.includes(level))
        && selected.every((level) => LEGACY_LEVELS.includes(level))
    }

    function StatusChip({ label, tone, active, onClick }) {
      const classes = ['mdc-chip']
      if (tone) classes.push(`mdc-chip-${tone}`)
      if (active) classes.push('mdc-chip-on')
      return h('button', {
        className: classes.join(' '),
        type: 'button',
        'aria-pressed': active ? 'true' : 'false',
        onClick,
      }, label)
    }

    function Footer() {
      const [state, setState] = useState({
        updatedAt: '',
        modelCount: 0,
        autoFill: true,
        unmatched: [],
        thinkingGaps: [],
        legacyThinking: [],
        reasoning: [],
        defaults: null,
      })
      const [panel, setPanel] = useState(null)
      const [busy, setBusy] = useState('')
      const [error, setError] = useState('')
      const [hint, setHint] = useState('')
      const unmatched = Array.isArray(state.unmatched) ? state.unmatched : []
      const thinkingGaps = Array.isArray(state.thinkingGaps) ? state.thinkingGaps : []
      const legacyThinking = Array.isArray(state.legacyThinking) ? state.legacyThinking : []
      const reasoning = Array.isArray(state.reasoning) ? state.reasoning : []
      const togglePanel = (next) => setPanel((current) => current === next ? null : next)
      const showDetail = panel === 'detail'
      const showGaps = (showDetail || panel === 'gap') && thinkingGaps.length > 0
      const showLegacy = (showDetail || panel === 'legacy') && legacyThinking.length > 0
      const showUnmatched = showDetail || panel === 'unmatched'

      const load = useCallback(async () => {
        const next = await api('/status')
        setState(next)
        setError('')
        return next
      }, [])

      useEffect(() => {
        load().catch((err) => setError(err.message))
      }, [load])

      const run = async (kind, work, okText) => {
        setBusy(kind)
        setError('')
        setHint('')
        try {
          const result = await work()
          await load()
          const text = typeof okText === 'function' ? okText(result) : okText
          if (text) setHint(text)
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
        } finally {
          setBusy('')
        }
      }

      return h('div', { className: 'mdc-wrap' },
        h('div', { className: 'mdc-row' },
          h('div', { className: 'mdc-head' },
            h(RefreshIcon),
            h('div', { className: 'mdc-body' },
              h('div', { className: 'mdc-title' }, '模型信息补全'),
              h('div', { className: 'mdc-meta' }, formatStamp(state.updatedAt, state.modelCount)),
            ),
          ),
          error ? h('div', { className: 'mdc-desc mdc-error' }, error) : null,
          hint ? h('div', { className: 'mdc-desc mdc-ok' }, hint) : null,
          h('div', { className: 'mdc-toolbar' },
            h('div', { className: 'mdc-chips' },
              unmatched.length ? h(StatusChip, {
                label: `未匹配 ${unmatched.length}`,
                active: panel === 'unmatched',
                onClick: () => togglePanel('unmatched'),
              }) : null,
              thinkingGaps.length ? h(StatusChip, {
                label: `档位未写明 ${thinkingGaps.length}`,
                active: panel === 'gap',
                onClick: () => togglePanel('gap'),
              }) : null,
              legacyThinking.length ? h(StatusChip, {
                label: `待确认 ${legacyThinking.length}`,
                tone: 'warn',
                active: panel === 'legacy',
                onClick: () => togglePanel('legacy'),
              }) : null,
            ),
            h('div', { className: 'mdc-actions' },
              h('label', { className: 'mdc-toggle' },
                h('input', {
                  type: 'checkbox',
                  checked: state.autoFill !== false,
                  disabled: Boolean(busy),
                  onChange: (event) => run('prefs', () => post('/prefs', { autoFill: event.target.checked })),
                }),
                '自动补全',
              ),
              h('button', {
                className: 'mdc-btn',
                type: 'button',
                onClick: () => togglePanel('detail'),
              }, showDetail ? '收起' : '详情'),
              h('button', {
                className: 'mdc-btn',
                type: 'button',
                disabled: Boolean(busy),
                onClick: () => run('fill', () => post('/fill', {}), fillHint),
              }, busy === 'fill' ? '补全中…' : '补全全部缺失'),
              h('button', {
                className: 'mdc-btn mdc-btn-primary',
                type: 'button',
                disabled: Boolean(busy),
                onClick: () => run('refresh', () => post('/refresh'), '百科已更新'),
              }, busy === 'refresh' ? '更新中…' : '更新'),
            ),
          ),
        ),
        panel ? h('div', { className: 'mdc-panel' },
          showDetail ? h('div', { className: 'mdc-desc' }, '按模型名补全上下文、输出上限、思考档位和图片能力。') : null,
          showDetail ? h(DefaultsForm, {
            defaults: state.defaults,
            busy: busy === 'defaults',
            onSave: (defaults) => run('defaults', () => post('/prefs', { defaults }), '默认值已保存'),
          }) : null,
          showDetail ? h('div', { className: 'mdc-item' },
            h('div', { className: 'mdc-block-title' }, '供应商默认档位'),
            reasoning.length === 0
              ? h('div', { className: 'mdc-desc' }, '还没有自定义供应商。')
              : reasoning.map((row) => h('div', { key: row.provider, className: 'mdc-desc' },
                `${row.displayName}：${reasoningRowText(row)}`,
              )),
          ) : null,
          showGaps ? h('div', { className: 'mdc-block-title' }, '档位未写明') : null,
          showGaps ? h('div', { className: 'mdc-desc' },
            '百科标明这些模型会思考，但没有写出 DSH 能用的离散档位（只有开关、token 预算、只写了会思考，或档位名 DSH 不认）。插件不会代填 minimal / low / medium / high，保持「保持未声明」保存就不会替它们声明任何档位。',
          ) : null,
          showGaps ? thinkingGaps.map((item) => h(UnmatchedRow, {
            key: `gap:${item.provider}/${item.id}`,
            item,
            kind: 'gap',
            fallbackLevels: state.defaults?.thinkingLevels,
            busy: busy === `model:${item.provider}/${item.id}`,
            onSave: (draft) => run(
              `model:${draft.provider}/${draft.id}`,
              () => post('/model', draft),
              `已保存 ${draft.id}`,
            ),
          })) : null,
          showLegacy ? h('div', { className: 'mdc-block-title' }, '疑似旧版本代填，请确认') : null,
          showLegacy ? h('div', { className: 'mdc-desc' },
            '这些模型的配置里正好是旧版本替「会思考」代填的四档（minimal / low / medium / high），而百科并没有写明档位。点「确认保留」表示这四档可以留下，这条会离开待确认；点「清掉档位」则不再声明思考档。改成别的档位后点「确认档位」。',
          ) : null,
          showLegacy ? legacyThinking.map((item) => h(UnmatchedRow, {
            key: `legacy:${item.provider}/${item.id}`,
            item,
            kind: 'legacy',
            fallbackLevels: state.defaults?.thinkingLevels,
            busy: busy === `model:${item.provider}/${item.id}`,
            onSave: (draft) => run(
              `model:${draft.provider}/${draft.id}`,
              () => post('/model', draft),
              (result) => {
                const still = Array.isArray(result?.legacyThinking)
                  && result.legacyThinking.some((row) => row.provider === draft.provider && row.id === draft.id)
                if (draft.confirmLegacy && still) {
                  throw new Error(`确认没有写上，${draft.id} 还在待确认里。重启 DSH 后再试一次。`)
                }
                if (draft.confirmLegacy) return `已确认保留 ${draft.id}`
                if (draft.thinkingMode === 'unset') return `已清掉 ${draft.id} 的档位`
                return `已保存 ${draft.id}`
              },
            ),
          })) : null,
          showUnmatched && (unmatched.length > 0 || thinkingGaps.length > 0 || legacyThinking.length > 0 || panel === 'unmatched')
            ? h('div', { className: 'mdc-block-title' }, '未匹配百科')
            : null,
          showUnmatched && unmatched.length === 0
            ? h('div', { className: 'mdc-desc' }, '当前没有未匹配的模型。')
            : null,
          showUnmatched ? unmatched.map((item) => h(UnmatchedRow, {
            key: `${item.provider}/${item.id}`,
            item,
            kind: 'unmatched',
            fallbackLevels: state.defaults?.thinkingLevels,
            busy: busy === `model:${item.provider}/${item.id}`,
            onSave: (draft) => run(
              `model:${draft.provider}/${draft.id}`,
              () => post('/model', draft),
              `已保存 ${draft.id}`,
            ),
          })) : null,
        ) : null,
      )
    }

    function ProviderCard(props) {
      const provider = props?.provider?.provider
      const hostRef = useRef(null)
      const buttonRef = useRef(null)
      const [busy, setBusy] = useState(false)
      const [hint, setHint] = useState('')
      const [unmatched, setUnmatched] = useState(0)
      const [gaps, setGaps] = useState(0)

      useEffect(() => {
        if (!provider) return
        api('/status').then((data) => {
          const list = Array.isArray(data.unmatched) ? data.unmatched : []
          const gapList = Array.isArray(data.thinkingGaps) ? data.thinkingGaps : []
          setUnmatched(list.filter((item) => item.provider === provider).length)
          setGaps(gapList.filter((item) => item.provider === provider).length)
        }).catch(() => {})
      }, [provider, hint])

      useLayoutEffect(() => {
        const host = hostRef.current
        const button = buttonRef.current
        if (!host || !button || !provider) return

        const card = host.closest('li')
        if (!card) return
        const actions = [...card.querySelectorAll('button')].filter((item) => item !== button)
        const edit = actions.find(isEditButton)
        const remove = actions.find(isRemoveButton)
        if (!edit?.parentElement) return

        const actionRow = edit.parentElement
        actionRow.insertBefore(button, remove || null)

        const hidden = []
        let node = host
        while (node && node !== card && node !== actionRow) {
          if (node.style) {
            hidden.push([node, node.style.display])
            node.style.display = 'none'
          }
          node = node.parentElement
        }

        return () => {
          for (const [el, display] of hidden) el.style.display = display
          if (button && host && !host.contains(button)) host.appendChild(button)
        }
      }, [provider])

      if (!provider) return null

      const fill = async () => {
        setBusy(true)
        setHint('')
        try {
          const result = await post('/fill', { provider })
          const count = Array.isArray(result.unmatched)
            ? result.unmatched.filter((item) => item.provider === provider).length
            : unmatched
          setUnmatched(count)
          const gapCount = Array.isArray(result.thinkingGaps)
            ? result.thinkingGaps.filter((item) => item.provider === provider).length
            : gaps
          setGaps(gapCount)
          const row = Array.isArray(result.reasoning)
            ? result.reasoning.find((item) => item.provider === provider)
            : null
          const parts = []
          if (result.filled) parts.push('已补全缺失字段')
          if (row?.level) parts.push(`默认档位 ${row.level}`)
          setHint(parts.length > 0 ? parts.join(' · ') : '没有缺失字段')
        } catch (err) {
          setHint(err instanceof Error ? err.message : String(err))
        } finally {
          setBusy(false)
        }
      }

      const label = busy
        ? '补全中…'
        : unmatched
          ? `补全缺失字段 · ${unmatched}`
          : '补全缺失字段'

      return h('div', { className: 'mdc-card', ref: hostRef },
        h('button', {
          ref: buttonRef,
          className: 'mdc-btn mdc-btn-inline',
          type: 'button',
          disabled: busy,
          title: hint || [
            unmatched ? `${unmatched} 个模型未匹配百科` : '',
            gaps ? `${gaps} 个模型的思考档位百科未写明` : '',
          ].filter(Boolean).join('；') || '按模型名补全上下文、输出上限、思考档位和图片能力',
          onClick: fill,
        }, label),
      )
    }

    exports.inject = ['slots']
    exports.apply = function apply(ctx) {
      ctx.effect(() => {
        document.getElementById(STYLE_ID)?.remove()
        const style = document.createElement('style')
        style.id = STYLE_ID
        style.textContent = CSS
        document.head.appendChild(style)
        return () => style.remove()
      }, 'model-info-fill: css')

      ctx.effect(() => ctx.slots.inject('settings.models.footer', () => ctx.slots.register({
        name: 'settings.models.footer',
        id: 'model-info-fill',
        order: 20,
        label: () => '模型信息补全',
      }, Footer)), 'model-info-fill: footer')

      ctx.effect(() => ctx.slots.inject('settings.models.provider-card', () => ctx.slots.register({
        name: 'settings.models.provider-card',
        key: 'llm-pi-ai',
      }, ProviderCard)), 'model-info-fill: provider-card')
    }

    return module.exports
  },
})
