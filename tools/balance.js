// Testet Balance und Determinismus ohne Browser: node tools/balance.js
const fs = require("fs"), vm = require("vm"), path = require("path");
for (const f of ["data.js", "dungeon.js", "sim.js"]) vm.runInThisContext(fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8"));
const G = globalThis.Game, d = G.generateDungeon(1);
const show = (name, b) => {
  const r = G.simulate(d, b).result;
  const f = G.simulate(d, b).frames.at(-1).hero;
  console.log(`${name.padEnd(34)} Kosten ${String(G.buildCost(b)).padStart(2)}  ${r.won ? "GESCHAFFT" : "tot     "} Zug ${String(r.turn).padStart(3)} ${r.killer || ""}${r.timeout ? "Zeit um" : ""}  (Stufe ${f.lvl}, Angriff ${f.atk}, Leben ${f.hp}/${f.maxHp}, ${f.kills} Siege)`);
  return r;
};
const a = show("Standard (ausgewogen)", G.defaultBuild());
const b2 = show("Standard nochmal", G.defaultBuild());
console.log("deterministisch:", JSON.stringify(a) === JSON.stringify(b2));
const builds = {
  "Tank: 6 Leben, 3 Rüstung, Jäger": { stats: { hp: 6, atk: 3, def: 3 }, abilities: [], tactic: "hunter" },
  "Glaskanone: 1/7/0 + Feuerball": { stats: { hp: 1, atk: 7, def: 0 }, abilities: ["fireball"], tactic: "hunter" },
  "Vampir-Jäger 3/4/0": { stats: { hp: 3, atk: 4, def: 0 }, abilities: ["vampire", "potions"], tactic: "hunter" },
  "Schleicher vorsichtig": { stats: { hp: 3, atk: 3, def: 1 }, abilities: ["stealth", "potions", "dodge"], tactic: "careful" },
  "Dornen + Regeneration": { stats: { hp: 4, atk: 2, def: 2 }, abilities: ["thorns", "regen"], tactic: "balanced" },
  "Berserker-Jäger": { stats: { hp: 4, atk: 4, def: 0 }, abilities: ["berserk", "potions"], tactic: "hunter" },
  "Alles Angriff ausgewogen": { stats: { hp: 2, atk: 8, def: 2 }, abilities: [], tactic: "balanced" },
};
for (const [n, b] of Object.entries(builds)) show(n, b);
// Zufällige Builds: wie viele schaffen es?
let wins = 0, N = 400, rnd = G.rng(42);
for (let i = 0; i < N; i++) {
  const b = { stats: { hp: 0, atk: 0, def: 0 }, abilities: [], tactic: G.TACTICS[Math.floor(rnd() * 3)].id };
  for (const ab of G.ABILITIES) if (rnd() < 0.25 && G.buildCost(b) + ab.cost <= G.BUDGET) b.abilities.push(ab.id);
  while (G.buildCost(b) < G.BUDGET) { const s = G.STATS[Math.floor(rnd() * 3)]; if (b.stats[s.id] < s.max) b.stats[s.id]++; }
  if (G.simulate(d, b).result.won) wins++;
}
console.log(`Zufällige Builds: ${wins}/${N} schaffen den Dungeon`);
