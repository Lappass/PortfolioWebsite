# Four featured projects and creator identity — 2026-10-07

The homepage now contains four featured discs, with four numbered selection
marks and a 01/04 counter. The visible interactive window contains one instance
of each work instead of the repeating wall; selection, drag, inertia, extraction
and the disc-to-console startup remain available. The reference opening keeps
its historical staging.

`content/archives.json` now contains `featured`, an ordered list of four IDs.
Current slots are X-001, X-004, X-007 and X-010, provisionally choosing existing
examples across four categories. These are content slots, not a claim that the
user has chosen these placeholder projects as final portfolio highlights.
All remaining records automatically enter Experiments. It provides compact
searchable, category-filtered rows ordered by date descending; ties retain
content order. Projects keep their existing direct routes and full detail pages.
Previous/next navigation stays within the current tier. Opening a small project
does not replace the featured selection or run the long console animation.

The top navigation replaces About's small circle with a labelled identity-card
icon, "认识我 / SHUHANG CHEN". Archive Index and Settings are removed from the
top; preferences are available in the footer. The slash shortcut opens Experiments.
Personal entry is now a 1.25-second card travelling from the identity button,
settling at the centre and expanding while the creator page appears. The page's
interactive particle sphere remains; the former full-screen particle-name entry
is superseded. Reduced motion opens immediately. Completion and interruption
cancel the animation and remove the temporary card.

Validation: production TypeScript/Vite/PWA build passed; 20 content tests passed,
including invalid, duplicate and reordered featured IDs. Edge browser checks at
1600×900, 390×844 and 844×390 checked four selector buttons, eight experiment
results, absence of the old top links, featured and experiment next/previous
routes, preserved home counter, identity entry and footer preferences. Card
completion/interruption were checked at 1600×900, 390×844 and 320×740, with
controlled-clock screenshots of the settled card. No page errors. Images in
`verification/portfolio-hierarchy/` were visually reviewed, including portrait
navigation spacing. Browser simulations are not physical iPhone validation.

The complete six-second insertion and return sequence was also rechecked at
desktop, portrait and landscape sizes: the archive hides during insertion, the
screen fits without tilt, the project route opens and the selection returns.

Latest user correction: retain the four-project tier and removed top links,
but withdraw the identity card. The original About button and particle-name
entry are restored. Footer preferences and Experiments remain available.
