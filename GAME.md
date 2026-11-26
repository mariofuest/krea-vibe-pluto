# Game: Pluto: Auto-Dungeon, Team Pluto

Shared notes for this team and its AI agents. Agents: read this at the start of every session and keep it short and current.

## Team
- Size: 1 (test run by the workshop leads)

## Concept
- 2D dungeon crawler as an auto-battler. Before the run the player spends 12 points on stats (life, attack, armour), abilities and a tactic. After "Play" the player decides nothing more: the whole run is simulated in advance and played back like a film (pause, step, rewind, speed).
- Same dungeon (seed, entered on the setup screen or via `?seed=17`) + same build = exactly the same run. Die, change the build, retry.
- The exit only opens once the boss (Höhlenwächter) in front of it is dead.
- Later (not yet): clearing a dungeon freezes the build, new options and new points unlock, then dungeon #2; failing there restarts at dungeon #2.

## Controls
- Setup: click +/−, ability cards, tactic. Play: Space = play/pause, ←/→ = one turn, timeline slider, speed 2×–60×.
- `index.html#play=80` starts a run and jumps to turn 80 (handy for testing).

## Files
- `js/data.js`: all numbers (stats, abilities, tactics, monsters, budget). Balance here.
- `js/dungeon.js`: seeded RNG and dungeon generation.
- `js/sim.js`: the simulation (hero AI, monster AI, combat); returns one frame per turn.
- `js/render.js`: draws a frame on the canvas (fog of war, effects).
- `js/ui.js`: setup screen, playback controls, attempts list (localStorage).
- `tools/arena.js`: `node tools/arena.js [--seeds 1-40] [--random 600]` tests named and random builds on many dungeons (all CPU cores) and reports win rates by tactic, ability, stat, best builds and hardest/easiest dungeons. Use it after every balance change.
- `assets/tiny-dungeon.png`: Kenney Tiny Dungeon tilesheet (CC0), sprite indices in `js/render.js`.
- `tools/snapshot.py` + `history/`: every prompt is stored as a playable version with prompt text and timing (see `history/index.html`).

## Versions and prompts
- After finishing each user request: run `python3 tools/snapshot.py --prompt-file <file with the user's prompt> --start <time the prompt was sent> --note "<one line: what changed>" --agent "<agent/model>"`, then commit and push.

## Currently working on
-

## Ideas / next steps
- Dungeon #2 with frozen build and extra points (see Concept).
- Balance (arena, 40 dungeons): ~45 % of random builds win; tactics 51/43/40 %. Stealth still weak, dungeon difficulty varies (11–88 %).
- Sound effects.
