# Asset Licenses

Pokémon Chess is a personal, non-commercial fan project. It is not affiliated with, endorsed by,
or sponsored by Nintendo, Game Freak, Creatures Inc. or The Pokémon Company.

Pokémon names, sprites and related artwork are trademarks and copyright of Nintendo, Game Freak
and The Pokémon Company. Do not use this project commercially. Pokémon game audio may be used for
private play (D9) but is never committed: it stays in the gitignored `apps/web/public/sfx/`.

Record every third-party asset added to the repo here.

| Asset                 | Source                                               | License                                          | Used for                          |
| --------------------- | ---------------------------------------------------- | ------------------------------------------------ | --------------------------------- |
| Species and type data | [@pkmn/dex](https://www.npmjs.com/package/@pkmn/dex) | MIT (code); game data © Nintendo et al.          | Roster build, type-chart tests    |
| Sound effects         | Synthesized in code (`apps/web/src/audio/`)          | Original (this project)                          | Default battle sounds             |
| Sound effects (local) | Owner-provided files in `apps/web/public/sfx/`       | © Nintendo et al.; private use, not in repo (D9) | Replace the defaults when present |
| Music                 | _TBD: CC0 or commissioned_                           |                                                  |                                   |
