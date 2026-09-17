// Viewers that are reachable but have nothing today and nothing in the next two
// weeks (an offseason league, one counting down to its opener, an in-season lull
// like an international break). A full card for each wastes a grid cell and reads
// as louder than it is, so they collapse to one recessive line apiece: name, then
// why it is quiet. The whole row still links into the viewer, and the name stays
// an <h3> so "one heading per live viewer" holds.
export default function DormantStrip({ items }) {
  if (!items.length) return null
  return (
    <section className="dormant-strip" aria-label="Not playing in the next two weeks">
      {items.map(({ v, phase }) => {
        // In season but quiet (a bye or a break) reads as "nothing in two weeks";
        // otherwise the phase label ("Starts in 34d", "Offseason") is the reason.
        const note =
          phase.tone === 'on' || phase.tone === 'hot'
            ? 'nothing in the next two weeks'
            : phase.label
        return (
          <a key={v.id} className="dormant-row" href={v.url}>
            <img
              className="dormant-icon"
              src={`${import.meta.env.BASE_URL}icons/${v.id}.png`}
              alt=""
              width="20"
              height="20"
              loading="lazy"
            />
            <h3 className="dormant-name">{v.name}</h3>
            <span className="dormant-note">{note}</span>
          </a>
        )
      })}
    </section>
  )
}
