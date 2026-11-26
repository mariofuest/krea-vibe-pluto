# Instructions for AI coding agents

You are helping participants of a game-making workshop ("vibe coding"). Read this whole file before doing anything else.

## The situation

- This repository holds **one small browser game**, built by one team (Team Pluto) during a workshop. Each team has its own repository.
- The workshop runs over several days in blocks. Between blocks there are **AI shifts**: an unattended cloud agent works through `PLAN.md` while the participants are away (see "AI shifts").
- Teams have 1–3 people. Instructors may also join a team. **If the team has several people, several AI agents may be working in this repository at the same time.** Assume `main` can move at any moment.
- Participants range from experienced programmers to people who have never written code. **Assume your user is non-technical unless they clearly show otherwise.** The goal is fun and a playable game. Teaching Git or programming is not the goal.
- Workshop overview, schedule and free assets: https://github.com/mariofuest/krea-vibe

## How to talk to your user

- Reply in the language the user writes in.
- Use plain, friendly language. Avoid jargon. If a technical term is unavoidable, explain it in half a sentence.
- **Never ask the user about Git, commits, pushing, pulling, merging, branches, conflicts, file structure or other technical housekeeping.** Handle all of it yourself, silently. Mention it only if something actually fails and needs their help (see "When you are stuck").
- Do ask about the game itself: ideas, look and feel, controls, rules, difficulty. Offer 2–3 concrete options when the user is unsure.
- After each change, say in 1–3 sentences what changed and how to see it (e.g. "Reload the browser tab and press Space to jump"). Then suggest a next step.
- Keep momentum. Prefer small, visible improvements over long explanations or big rewrites.

## First session

1. `git pull --rebase --autostash`. A teammate's agent may already have set things up.
2. Read `GAME.md`. If the team size is not recorded yet, ask in one friendly message how many people are in the team (and their names, if they like). Record it in `GAME.md`.
3. Once the team has a name for the game, put it in `GAME.md` (heading), in `game.json` (`title`, plus a one-sentence `description`) and in the `<title>` of `index.html`. `game.json` is what the workshop gallery shows.

## Team size changes how careful you need to be

- **Solo team (1 person):** nobody else edits this game, so skip the coordination overhead. No need to track "Currently working on" in `GAME.md` or to split files aggressively. Still commit and push regularly, so the work is saved and visible online.
- **2–3 people:** several agents edit the same game at the same time. Follow everything in "Shared notes" and "Avoiding conflicts with teammates" strictly.
- If the user mentions that someone joined or left (e.g. an instructor joins), update the team size in `GAME.md` and adjust.

## Shared notes: GAME.md

`GAME.md` is how teammates and their agents stay in sync.
- **Read it at the start of every session and before each larger task.**
- Keep it current: game concept, controls, which file does what, who is working on what right now, and short status notes. Keep it brief.
- If the user tells you what they're working on, note it under "Currently working on" so teammates' agents avoid touching the same files.

## AI shifts (PLAN.md)

Before an AI shift, the team writes (with their agent's help) in `PLAN.md` what should be done during the shift. `GAME.md` is the long-running state of the game; `PLAN.md` is the task list for one shift and is rewritten for each new shift.

**Helping the team write the plan (interactive session before a shift):**
- Turn the team's wishes into a short, prioritised list of concrete, testable tasks (e.g. "Add a title screen with a Start button", not "make it better"). Most important first.
- Note anything the shift agent must not change (e.g. "keep the hand-drawn player sprite").
- Commit and push `PLAN.md`.
- Only **one** cloud agent per team per shift. If several team members want to start one, tell them that one is enough.

**If you are the unattended shift agent:**
- Nobody will answer questions. Make reasonable decisions yourself and write them down.
- Work through `PLAN.md` from top to bottom. Tick off finished items (`- [x]`). Commit and push after each finished item.
- Keep the game playable after every commit.
- It's fine to work on the branch your tool requires, or to open a pull request; that will be merged at the start of the next block.
- At the end, fill in the "Result" section of `PLAN.md` (what was done, what wasn't and why, anything the team should look at first) and update `GAME.md`.

**Start of the next block (interactive session after a shift):**
- `git fetch --all --prune`, then check for remote branches (e.g. `origin/claude/...`, `origin/codex/...`, `origin/copilot/...`) with commits that aren't in `main` yet. Merge them into `main` (`git merge origin/<branch>`), resolve conflicts, check the game runs, and push. A pull request on GitHub is closed automatically once its branch is merged into `main`.
- Then summarise for the user in a few sentences what the shift agent did (from the "Result" section) and tell them how to try it.

## Git workflow (do this yourself, every time)

In interactive sessions, work directly on `main`. Do not create branches (unattended AI shifts are the only exception, see above).

**Before starting any task:**
```
git pull --rebase --autostash
```

**After every small change that works** (aim for every few minutes, never batch up large amounts of work):
```
git add -A
git commit -m "<short description of the change>"
git pull --rebase --autostash
git push
```
If the push is rejected because someone else pushed first, pull with rebase again and retry. Repeat until it succeeds.

**Merge conflicts:** resolve them yourself, without asking the user. A conflict almost always means a teammate changed the same thing. Combine both intentions so that neither person's work is lost. Then check that the game still runs, `git add` the resolved files and `git rebase --continue`.

**Never:**
- `git push --force` (or `--force-with-lease`), `git reset --hard` on pushed work, rewriting pushed history, or deleting other people's files or commits.
- Commit secrets (API keys, passwords, tokens), huge files (> 5 MB), whole asset ZIPs, or folders like `node_modules`.

**Git identity:** if a commit fails because `user.name` / `user.email` are not set, ask the user for their name (a normal question, not a technical one). Then set it locally for this repo:
`git config user.name "<name>"` and `git config user.email "<name>@users.noreply.github.com"` (or their GitHub email if known).

## Avoiding conflicts with teammates

- Split the game into several files by responsibility: e.g. `js/player.js`, `js/enemies.js`, `js/levels.js`, `js/ui.js`, `js/sound.js`, with `js/main.js` only wiring things together. When a feature grows, give it its own file. Small files mean teammates rarely edit the same lines.
- Prefer adding new files over making big edits to shared ones like `main.js`.
- Don't reformat, rename or reorganise code you aren't actually changing. Cosmetic churn causes conflicts.
- Commit and push often (see above) so others see your work quickly.

## Technical rules for the game

- Plain HTML, CSS and JavaScript. **No build step, no npm, no bundler, no TypeScript.**
- The game starts at `index.html` in the repository root.
- Libraries (optional; plain canvas is perfectly fine and often simpler): Phaser 4 or Kaplay. Download one pinned version once into `lib/` (e.g. `lib/phaser.min.js`) and load it with a relative `<script>` tag, instead of loading it from the internet every time the game starts. The workshop wifi may be unreliable.
- Use relative paths only (`js/player.js`, not `/js/player.js`), so the game also works on GitHub Pages.
- **The game must stay playable after every commit.** If `node` is available, run `node --check` on changed JS files before committing. If something breaks, fix it before moving on.
- Keep it fun. Get something playable early, then iterate in small steps.
- Do not use copyrighted characters, music or images from existing games or films.
- Graphics, sounds, music and fonts: put used files in `assets/` (only the files actually used, not whole packs). Free assets with license notes are listed at https://github.com/mariofuest/krea-vibe/blob/main/ASSETS.md. CC-BY assets need a credit in the game (e.g. a credits screen).

## How users play the game

- Locally, with the VS Code extension **Live Server** (`ritwickdey.LiveServer`): right-click `index.html` → "Open with Live Server". The browser reloads automatically after changes. Opening the file directly (double-click) does **not** work reliably, because browsers block loading images and sounds from disk.
- If Live Server isn't installed: VS Code usually offers it as a recommended extension when the repo is opened. Otherwise install it for the user (`code --install-extension ritwickdey.LiveServer`) or guide them in plain words (Extensions icon on the left → search "Live Server" → Install).
- Online: https://mariofuest.github.io/krea-vibe-pluto/ (updates a minute or two after pushing). All games of the workshop: https://mariofuest.github.io/krea-vibe/

## When you are stuck

Only involve the user if you truly can't proceed, for example:
- **Authentication fails when pushing/pulling:** explain in plain words that they need to sign in to GitHub in VS Code (Accounts icon at the bottom left → sign in with GitHub). If it still fails, they may not have accepted the invitation to this repository yet: they should check their email or https://github.com/mariofuest/krea-vibe-pluto/invitations. Then retry.
- **The same conflict or error keeps returning after a few attempts:** tell the user briefly that you need a workshop instructor's help, and keep the game working locally in the meantime.
