import { ARCHIVED_VIEWERS } from '../data/viewers.js'

// Finished editions, collapsed by default.
//
// A native <details> rather than a useState toggle: it is closed by default with no JS, it
// is keyboard- and screen-reader-operable for free, and — because the content is still in
// the DOM — a browser's in-page find still turns it up. The open state is deliberately NOT
// persisted; "hidden by default" means every visit, since these are archives rather than a
// view the user is working in.
//
// No feeds, no phase badges, no game rows. These tournaments are over, so the only useful
// things are a way in and the year the competition returns. Result/champion is deliberately
// absent — see the note in data/viewers.js about spoiler-free mode.
export default function ArchivedShelf({ viewers = ARCHIVED_VIEWERS }) {
  if (!viewers.length) return null

  return (
    <details className="archived">
      <summary className="archived-summary">
        <span className="archived-label">
          {/* An explicit chevron, because `display: flex` on a <summary> makes Chrome drop
              the native ::marker — verified in the browser, where the row rendered with no
              affordance at all. Rotated by CSS on [open]; matches YesterdayRecap's ▸/▾. */}
          <span className="archived-chevron" aria-hidden="true">
            ▸
          </span>
          <span aria-hidden="true">🗄️</span> Completed tournaments
        </span>
        <span className="archived-count dim">
          {viewers.length} archived {viewers.length === 1 ? 'viewer' : 'viewers'}
        </span>
      </summary>

      <p className="dim archived-note">
        Finished editions. The apps still work — every result, bracket and standing is in
        them — but each competition is between editions, so they stay out of the way up top.
        Soonest to return first.
      </p>

      <ul className="archived-list">
        {viewers.map((v) => (
          <li className="archived-item" key={v.id}>
            <a className="archived-link" href={v.url}>
              <img
                className="archived-icon"
                src={`${import.meta.env.BASE_URL}icons/${v.id}.png`}
                alt=""
                width="28"
                height="28"
                loading="lazy"
              />
              <span className="archived-name">
                {v.name} <span className="dim">{v.edition}</span>
              </span>
            </a>
            {v.nextEdition && <span className="archived-next dim">Next in {v.nextEdition}</span>}
          </li>
        ))}
      </ul>
    </details>
  )
}
