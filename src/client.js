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

    const CSS = `
.mdc-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border: .5px solid var(--dsw-alias-border-l4, rgba(127,127,127,.2));
  border-radius: 16px;
  background: transparent;
  color: var(--dsw-alias-label-primary, inherit);
  box-sizing: border-box;
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
.mdc-desc {
  margin-top: 2px;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary, #888);
}
.mdc-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
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

    function Footer() {
      const [state, setState] = useState({
        updatedAt: '',
        modelCount: 0,
        autoFill: true,
      })
      const [busy, setBusy] = useState('')
      const [error, setError] = useState('')

      const load = useCallback(async () => {
        const next = await api('/status')
        setState(next)
        setError('')
      }, [])

      useEffect(() => {
        load().catch((err) => setError(err.message))
      }, [load])

      const run = async (kind, work) => {
        setBusy(kind)
        setError('')
        try {
          await work()
          await load()
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
        } finally {
          setBusy('')
        }
      }

      return h('div', { className: 'mdc-row' },
        h(RefreshIcon),
        h('div', { className: 'mdc-body' },
          h('div', { className: 'mdc-title' }, '模型信息补全'),
          h('div', { className: 'mdc-desc' },
            '按模型名补全上下文、输出上限、思考档位和图片能力。',
            formatStamp(state.updatedAt, state.modelCount),
          ),
          error ? h('div', { className: 'mdc-desc mdc-error' }, error) : null,
        ),
        h('div', { className: 'mdc-actions' },
          h('label', { className: 'mdc-toggle' },
            h('input', {
              type: 'checkbox',
              checked: state.autoFill !== false,
              disabled: Boolean(busy),
              onChange: (event) => run('prefs', () => api('/prefs', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ autoFill: event.target.checked }),
              })),
            }),
            '自动补全',
          ),
          h('button', {
            className: 'mdc-btn',
            type: 'button',
            disabled: Boolean(busy),
            onClick: () => run('fill', () => api('/fill', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: '{}',
            })),
          }, busy === 'fill' ? '补全中…' : '补全全部缺失'),
          h('button', {
            className: 'mdc-btn mdc-btn-primary',
            type: 'button',
            disabled: Boolean(busy),
            onClick: () => run('refresh', () => api('/refresh', { method: 'POST' })),
          }, busy === 'refresh' ? '更新中…' : '更新'),
        ),
      )
    }

    function ProviderCard(props) {
      const provider = props?.provider?.provider
      const hostRef = useRef(null)
      const buttonRef = useRef(null)
      const [busy, setBusy] = useState(false)
      const [hint, setHint] = useState('')

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
          const result = await api('/fill', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ provider }),
          })
          setHint(result.filled ? '已补全缺失字段' : '没有缺失字段')
        } catch (err) {
          setHint(err instanceof Error ? err.message : String(err))
        } finally {
          setBusy(false)
        }
      }

      return h('div', { className: 'mdc-card', ref: hostRef },
        h('button', {
          ref: buttonRef,
          className: 'mdc-btn mdc-btn-inline',
          type: 'button',
          disabled: busy,
          title: hint || '按模型名补全上下文、输出上限、思考档位和图片能力',
          onClick: fill,
        }, busy ? '补全中…' : '补全缺失字段'),
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
