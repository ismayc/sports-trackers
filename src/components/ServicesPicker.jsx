import { useEffect } from 'react'
import { SERVICE_CATALOG } from '../utils/watch.js'

const GROUPS = [
  ['stream', 'Streaming'],
  ['bundle', 'Live TV & cable'],
]

// Pick the TV / streaming services you have. Selection is lifted to App (persisted to
// localStorage there); this component is presentational plus a little a11y (Escape closes,
// backdrop click closes).
export default function ServicesPicker({ selected, onChange, onClose }) {
  const set = new Set(selected)
  const toggle = (key) => {
    const next = new Set(set)
    next.has(key) ? next.delete(key) : next.add(key)
    onChange([...next])
  }

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="My services"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>My TV &amp; streaming</h2>
        <p className="dim modal-note">
          Pick what you have and the family page can show only the games you can actually watch.
        </p>
        {GROUPS.map(([kind, label]) => (
          <fieldset className="svc-group" key={kind}>
            <legend>{label}</legend>
            <div className="svc-grid">
              {SERVICE_CATALOG.filter((s) => s.kind === kind).map((s) => (
                <label key={s.key} className={`svc ${set.has(s.key) ? 'on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={set.has(s.key)}
                    onChange={() => toggle(s.key)}
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <div className="modal-actions">
          {selected.length > 0 && (
            <button className="btn-link" onClick={() => onChange([])}>
              Clear all
            </button>
          )}
          <button className="btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
