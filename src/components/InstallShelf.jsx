import { VIEWERS } from '../data/viewers.js'

// The install / subscribe shelf: every shown viewer with an Open link and, where a Netlify
// calendar feed exists, a webcal:// Subscribe link that adds the season to the user's
// calendar app. Only viewers that declare a `calendarHost` get a Subscribe button — the
// hub never invents a feed that isn't there.
export default function InstallShelf({ viewers = VIEWERS }) {
  return (
    <section className="shelf">
      <h2>Install &amp; subscribe</h2>
      <p className="dim shelf-note">Open any viewer, or subscribe to its season in your calendar app.</p>
      <ul className="shelf-list">
        {viewers.map((v) => (
          <li className="shelf-item" key={v.id}>
            <img
              className="shelf-icon"
              src={`${import.meta.env.BASE_URL}icons/${v.id}.png`}
              alt=""
              width="24"
              height="24"
              loading="lazy"
            />
            <span className="shelf-name">{v.name}</span>
            <span className="shelf-links">
              <a href={v.url}>Open</a>
              {v.calendarHost && (
                <a href={`webcal://${v.calendarHost}/calendar.ics`} title={`Subscribe to ${v.name} in your calendar`}>
                  📅 Subscribe
                </a>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
