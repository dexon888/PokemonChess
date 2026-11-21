# Local sound files (D9)

Drop your own sound clips here to replace the built-in synthesized sounds. **Everything in this
folder except this README is gitignored**: the repo is public, so Pokémon game audio must never be
committed. These files exist only on your machine (and are served by your dev server).

Use these exact names. Each can be `.mp3`, `.ogg` or `.wav`; the game tries them in that order.
Any file that's missing falls back to the synthesized sound, so you can add them one at a time.

| File name            | Plays when                                          |
| -------------------- | --------------------------------------------------- |
| `move`               | a piece moves without a battle (including castling) |
| `capture`            | a normal 1× hit knocks a piece out                  |
| `super-effective`    | a 2× super-effective hit                            |
| `not-very-effective` | a ½× hit (both pieces faint)                        |
| `critical`           | a critical hit                                      |
| `dodge`              | the defender dodges                                 |
| `immune`             | the attack has no effect (0×)                       |
| `victory`            | you win (the winner in a hot-seat game)             |
| `defeat`             | you lose online                                     |

For example: `super-effective.mp3`, `not-very-effective.mp3`, `critical.wav`.

After adding or changing files, reload the page. Keep clips short (under a second for battle
sounds); the volume slider in the game applies to all of them.
