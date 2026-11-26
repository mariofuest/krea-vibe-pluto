// Arena: testet viele Builds auf vielen Dungeons und zeigt, was stark und was schwach ist.
//
//   node tools/arena.js                       # Standard: Dungeons 1–40, 600 Zufalls-Builds
//   node tools/arena.js --seeds 1-100 --random 2000
//   node tools/arena.js --seeds 7             # nur ein Dungeon
//   node tools/arena.js --json arena.json     # Rohdaten zusätzlich als JSON speichern
//
// Läuft parallel auf allen Prozessorkernen.
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
const fs = require("fs"), path = require("path"), vm = require("vm"), os = require("os");

function loadGame() {
  for (const f of ["data.js", "dungeon.js", "sim.js"])
    vm.runInThisContext(fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8"), { filename: f });
  return globalThis.Game;
}

// ---------------------------------------------------------------- Worker
if (!isMainThread) {
  const G = loadGame();
  const dungeons = new Map();
  const out = workerData.jobs.map(({ b, builds, seeds }) => {
    return builds.map(build => seeds.map(seed => {
      if (!dungeons.has(seed)) dungeons.set(seed, G.generateDungeon(seed));
      const r = G.simulate(dungeons.get(seed), build, { fast: true }).result;
      return [r.won ? 1 : 0, r.turn, r.lvl, r.killer || (r.timeout ? "Zeit" : "")];
    }));
  });
  parentPort.postMessage(out);
  return;
}

// ---------------------------------------------------------------- Hauptprogramm
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : true]);
  return acc;
}, []));
const G = loadGame();
const seeds = (() => {
  const s = String(args.seeds || "1-40"), out = [];
  for (const part of s.split(",")) {
    const [a, b] = part.split("-").map(Number);
    for (let x = a; x <= (b || a); x++) out.push(x);
  }
  return out;
})();
const nRandom = Number(args.random || 600);

const ARCHETYPES = {
  "Standard-Build": G.defaultBuild(),
  "Festung, vorsichtig (L6 R6)": { stats: { hp: 6, atk: 0, def: 6 }, abilities: [], tactic: "careful" },
  "Festung, ausgewogen (L6 R6)": { stats: { hp: 6, atk: 0, def: 6 }, abilities: [], tactic: "balanced" },
  "Festung, Jäger (L6 R6)": { stats: { hp: 6, atk: 0, def: 6 }, abilities: [], tactic: "hunter" },
  "Ausgeglichen (L4 A4 R4)": { stats: { hp: 4, atk: 4, def: 4 }, abilities: [], tactic: "balanced" },
  "Glaskanone + Feuerball, Jäger": { stats: { hp: 1, atk: 8, def: 0 }, abilities: ["fireball"], tactic: "hunter" },
  "Vampir-Jäger": { stats: { hp: 3, atk: 4, def: 0 }, abilities: ["vampire", "potions"], tactic: "hunter" },
  "Schleicher, vorsichtig": { stats: { hp: 3, atk: 3, def: 1 }, abilities: ["stealth", "potions", "dodge"], tactic: "careful" },
  "Dornen + Regeneration": { stats: { hp: 4, atk: 2, def: 2 }, abilities: ["thorns", "regen"], tactic: "balanced" },
  "Berserker-Jäger": { stats: { hp: 4, atk: 4, def: 0 }, abilities: ["berserk", "potions"], tactic: "hunter" },
};

function randomBuild(rnd) {
  const b = { stats: { hp: 0, atk: 0, def: 0 }, abilities: [], tactic: G.TACTICS[Math.floor(rnd() * G.TACTICS.length)].id };
  for (const ab of G.ABILITIES) if (rnd() < 0.25 && G.buildCost(b) + ab.cost <= G.BUDGET) b.abilities.push(ab.id);
  let guard = 0;
  while (G.buildCost(b) < G.BUDGET && guard++ < 100) {
    const s = G.STATS[Math.floor(rnd() * G.STATS.length)];
    if (b.stats[s.id] < s.max) b.stats[s.id]++;
  }
  return b;
}
const rnd = G.rng(4242);
const randoms = Array.from({ length: nRandom }, () => randomBuild(rnd));
// Paarvergleich: Build ohne Fähigkeit X gegen denselben Build mit X, bezahlt mit Wertepunkten
const nPairs = Number(args.pairs || 60);
const pairs = [];
for (const ab of G.ABILITIES) {
  let found = 0;
  for (const b of randoms) {
    if (found >= nPairs) break;
    if (b.abilities.includes(ab.id)) continue;
    const v = JSON.parse(JSON.stringify(b));
    let pay = ab.cost;
    for (const s of ["hp", "atk", "def", "hp", "atk", "def", "hp", "atk", "def", "hp", "atk", "def"]) {
      if (pay === 0) break;
      const top = ["hp", "atk", "def"].sort((x, y) => v.stats[y] - v.stats[x])[0];
      if (v.stats[top] > 0) { v.stats[top]--; pay--; }
    }
    if (pay > 0) continue;
    v.abilities.push(ab.id);
    pairs.push({ ab: ab.id, base: randoms.indexOf(b), variant: v });
    found++;
  }
}
const allBuilds = [...Object.values(ARCHETYPES), ...randoms, ...pairs.map(p => p.variant)];

// Arbeit auf Kerne verteilen
const nWorkers = Math.min(os.cpus().length, 16);
const chunks = Array.from({ length: nWorkers }, () => []);
allBuilds.forEach((b, i) => chunks[i % nWorkers].push(i));
const t0 = Date.now();
console.log(`Starte ${allBuilds.length * seeds.length} Läufe auf ${nWorkers} Kernen …`);
Promise.all(chunks.map(idx => new Promise((res, rej) => {
  const w = new Worker(__filename, { workerData: { jobs: [{ builds: idx.map(i => allBuilds[i]), seeds }] } });
  w.on("message", m => res({ idx, data: m[0] })); w.on("error", rej);
}))).then(parts => {
  const results = new Array(allBuilds.length);
  for (const p of parts) p.idx.forEach((bi, k) => { results[bi] = p.data[k]; });
  report(results, (Date.now() - t0) / 1000);
});

// ---------------------------------------------------------------- Auswertung
const pct = x => (100 * x).toFixed(0).padStart(3) + " %";
const winRate = res => res.reduce((s, r) => s + r[0], 0) / res.length;
const label = b => `L${b.stats.hp} A${b.stats.atk} R${b.stats.def} ${b.abilities.map(a => G.ABILITIES.find(x => x.id === a).icon).join("")} ${G.TACTICS.find(t => t.id === b.tactic).name}`;

function report(results, secs) {
  const sims = allBuilds.length * seeds.length;
  console.log(`\n${sims} Läufe (${allBuilds.length} Builds × ${seeds.length} Dungeons) in ${secs.toFixed(1)} s\n`);

  console.log("BENANNTE BUILDS                     Siege   Ø Züge (Sieg)  Ø Stufe  häufigster Tod");
  Object.keys(ARCHETYPES).forEach((name, i) => {
    const res = results[i], wins = res.filter(r => r[0]);
    const killers = {}; res.filter(r => !r[0]).forEach(r => killers[r[3]] = (killers[r[3]] || 0) + 1);
    const topKiller = Object.entries(killers).sort((a, b) => b[1] - a[1])[0];
    console.log(`${name.padEnd(34)} ${pct(winRate(res))}   ${(wins.length ? (wins.reduce((s, r) => s + r[1], 0) / wins.length).toFixed(0) : "–").padStart(6)}        ${(res.reduce((s, r) => s + r[2], 0) / res.length).toFixed(1).padStart(4)}    ${topKiller ? topKiller[0] + " (" + topKiller[1] + "×)" : ""}`);
  });

  const nA = Object.keys(ARCHETYPES).length;
  const R = results.slice(nA, nA + randoms.length), B = randoms;
  const V = results.slice(nA + randoms.length);
  const overall = R.reduce((s, r) => s + winRate(r), 0) / R.length;
  console.log(`\nZUFALLS-BUILDS: Ø ${pct(overall)} Siegquote\n`);

  console.log("NACH TAKTIK");
  for (const t of G.TACTICS) {
    const sel = R.filter((_, i) => B[i].tactic === t.id);
    console.log(`  ${t.name.padEnd(12)} ${pct(sel.reduce((s, r) => s + winRate(r), 0) / sel.length)}  (${sel.length} Builds)`);
  }

  console.log("\nFÄHIGKEITEN, FAIRER VERGLEICH (gleicher Build, Fähigkeit statt Wertepunkten)");
  G.ABILITIES.map(a => {
    const idx = pairs.map((p, i) => [p, i]).filter(([p]) => p.ab === a.id);
    const without = idx.reduce((s, [p]) => s + winRate(R[p.base]), 0) / idx.length;
    const withA = idx.reduce((s, [, i]) => s + winRate(V[i]), 0) / idx.length;
    return [a, withA - without, idx.length];
  }).sort((x, y) => y[1] - x[1]).forEach(([a, d, n]) =>
    console.log(`  ${(a.icon + " " + a.name + " (" + a.cost + ")").padEnd(24)} ${(d >= 0 ? "+" : "") + (d * 100).toFixed(1).padStart(5)} Pkt  (${n} Paare)`));

  console.log("\nFÄHIGKEITEN (Siegquote mit / ohne, Differenz; Vorsicht: vergleicht verschiedene Builds)");
  const rows = G.ABILITIES.map(a => {
    const w = R.filter((_, i) => B[i].abilities.includes(a.id)), wo = R.filter((_, i) => !B[i].abilities.includes(a.id));
    const rw = w.reduce((s, r) => s + winRate(r), 0) / w.length, rwo = wo.reduce((s, r) => s + winRate(r), 0) / wo.length;
    return [a, rw, rwo];
  }).sort((x, y) => (y[1] - y[2]) - (x[1] - x[2]));
  for (const [a, rw, rwo] of rows)
    console.log(`  ${(a.icon + " " + a.name + " (" + a.cost + ")").padEnd(22)} ${pct(rw)} / ${pct(rwo)}   ${((rw - rwo) * 100 >= 0 ? "+" : "") + ((rw - rwo) * 100).toFixed(0)} Pkt  → ${((rw - rwo) * 100 / a.cost).toFixed(1)} pro Kostenpunkt`);

  console.log("\nWERTE (Siegquote nach investierten Punkten)");
  for (const s of G.STATS) {
    const line = [];
    for (let v = 0; v <= s.max; v += 2) {
      const sel = R.filter((_, i) => B[i].stats[s.id] >= v && B[i].stats[s.id] < v + 2);
      if (sel.length >= 5) line.push(`${v}–${v + 1}: ${pct(sel.reduce((a, r) => a + winRate(r), 0) / sel.length).trim()}`);
    }
    console.log(`  ${s.name.padEnd(8)} ${line.join("   ")}`);
  }

  console.log("\nBESTE ZUFALLS-BUILDS");
  R.map((r, i) => [winRate(r), i]).sort((a, b) => b[0] - a[0]).slice(0, Number(args.top || 10))
    .forEach(([w, i]) => console.log(`  ${pct(w)}  ${label(B[i])}`));

  console.log("\nDUNGEONS (Siegquote aller Zufalls-Builds je Seed)");
  const perSeed = seeds.map((s, k) => [s, R.reduce((a, r) => a + r[k][0], 0) / R.length]).sort((a, b) => a[1] - b[1]);
  const fmt = x => `#${x[0]} ${pct(x[1]).trim()}`;
  console.log(`  schwerste: ${perSeed.slice(0, 5).map(fmt).join(", ")}`);
  console.log(`  leichteste: ${perSeed.slice(-5).reverse().map(fmt).join(", ")}`);

  if (args.json) {
    fs.writeFileSync(args.json, JSON.stringify({ seeds, builds: allBuilds, results }, null, 0));
    console.log(`\nRohdaten: ${args.json}`);
  }
}
