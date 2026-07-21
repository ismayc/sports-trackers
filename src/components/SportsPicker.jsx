import { useEffect } from 'react'
import { VIEWERS } from '../data/viewers.js'

// Choose which viewers appear on the hub. `selected` is an array of viewer ids, or null
// meaning "all" (the default, and what we store back whenever every sport is checked — so a
// viewer added later still shows up for everyone who hasn't narrowed the list).
export default function SportsPicker({ selected, onChange, onClose }) {
  const allIds = VIEWERS.map((v) => v.id)
  const shown = new Set(selected && selected.length ? selected : allIds)

  const toggle = (id) => {
    const next = new Set(shown)
    next.has(id) ? next.delete(id) : next.add(id)
    // Keep at least one; storing null when everything is on keeps it forward-compatible.
    if (next.size === 0) return
    onChange(next.size === allIds.length ? null : [...next])
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
        aria-label="Choose sports"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Which sports to show</h2>
        <p className="dim modal-note">Pick the viewers you want on this page.</p>
        <div className="svc-grid">
          {VIEWERS.map((v) => (
            <label key={v.id} className={`svc svc-sport ${shown.has(v.id) ? 'on' : ''}`}>
              <input
                type="checkbox"
                checked={shown.has(v.id)}
                onChange={() => toggle(v.id)}
                disabled={shown.size === 1 && shown.has(v.id)}
              />
              <img
                className="svc-icon"
                src={`${import.meta.env.BASE_URL}icons/${v.id}.png`}
                alt=""
                width="22"
                height="22"
              />
              {v.name}
            </label>
          ))}
        </div>
        <div className="modal-actions">
          {selected && selected.length > 0 && (
            <button className="btn-link" onClick={() => onChange(null)}>
              Show all
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
