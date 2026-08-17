// One team's crest, sized for a game row.
//
// ONE image, always the light-background mark, with a pale chip behind it in dark mode (see
// .team-logo in index.css). The obvious alternative, swapping in ESPN's dark variant, was
// tried and does not work: `-dark` means different things at different paths (
// `wnba/500-dark/scoreboard/sea.png` is the light-on-dark mark, `wnba/500-dark/chi.png` is a
// DARK-coloured one), and four of the fifteen WNBA clubs have no dark asset at all, which
// their standings entry states honestly. Verified in Chrome on 2026-08-17: deriving the URL
// put an invisible crest on a dark row for Atlanta, Chicago, Indiana and Phoenix, and an
// image that loads but cannot be seen has no error to fall back from. The chip is the one
// rule that holds for all 97 teams.
export default function TeamLogo({ logo, size = 16 }) {
  if (!logo) return null
  return <img className="team-logo" src={logo} alt="" width={size} height={size} loading="lazy" />
}
