# Experience logos

Particles in the profile's Experience section form the logos named by each entry's `logo` field in `content/profile.json`. A field may list several files; they are placed side by side in one node. A missing file is skipped, and an entry with none keeps a plain node.

All files were retrieved on 2026-10-22 and rebuilt as minimal SVGs that keep only the official path data (no scripts, styles or external references). Each file also notes its source in a comment.

| File | Mark | Source | Changes |
|---|---|---|---|
| `nyu.svg` | New York University torch | Wikimedia Commons, [File:Nyu_stacked_black.svg](https://commons.wikimedia.org/wiki/File:Nyu_stacked_black.svg) (public domain text logo, trademarked; Commons credits NYU's style guide downloads) | Kept the square with the torch knocked out; removed the "NYU" letters and the white fill behind the torch |
| `yahaha.svg` | Yahaha Studios | `https://www-cdn.yahaha.com/images/logo.svg`, the logo on yahaha.com | None apart from dropping the fixed width and height |
| `hypergryph.svg` | Hypergryph (鹰角网络) | `https://web-ipv6.hycdn.cn/hypergryph/official/assets/img/logo.a085fd.svg`, the logo on hypergryph.com | Kept the mark; removed the 鹰角网络 and HYPERGRYPH wordmarks |
| `next.svg` | Question mark for the open "Future" entry | Drawn for this site | — |
| `endfield.svg` | Arknights: Endfield | Header logo of https://endfield.hypergryph.com/ (inline SVG) | Kept the 终末地 characters and block; removed the 明日方舟 and ARKNIGHTS ENDFIELD lettering |

For a new logo, use a single-colour mark on a transparent background: only opaque pixels become particles, so a logo drawn on a filled square turns into a solid square unless its inner shape is cut out. Any aspect ratio works; each mark is fitted inside a square.

These marks only identify the author's school, employers and the project worked on. Trademarks belong to their respective owners; the portfolio is not affiliated with or endorsed by them. This is the one place the project uses Arknights-related marks (see `AGENTS.md`).
