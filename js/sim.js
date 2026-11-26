// Die Simulation: spielt den ganzen Lauf im Voraus durch und speichert jeden Zug als "Frame".
// Gleicher Dungeon + gleicher Build = immer exakt derselbe Ablauf.
var Game = (typeof window !== "undefined" ? window : globalThis).Game || ((typeof window !== "undefined" ? window : globalThis).Game = {});

Game.MAX_TURNS = 900;
Game.SIGHT = 6;

Game.simulate = function (dungeon, build, opts) {
  var fast = opts && opts.fast; // nur Ergebnis, keine Frames (für Balance-Tests)
  var W = dungeon.w, H = dungeon.h, T = dungeon.tiles;
  var rnd = Game.rng(dungeon.seed * 7919 + 17);
  var has = {};
  build.abilities.forEach(function (a) { has[a] = true; });
  var stat = function (id) {
    var s = Game.STATS.find(function (x) { return x.id === id; });
    return s.base + s.per * (build.stats[id] || 0);
  };
  var tactic = build.tactic;
  var sight = Game.SIGHT + (has.torch ? 3 : 0);
  var spawnRnd = Game.rng(dungeon.seed * 31337 + 5);

  var hero = {
    x: dungeon.start.x, y: dungeon.start.y, maxHp: stat("hp"), atk: stat("atk"), def: stat("def"),
    lvl: 1, xp: 0, potions: has.potions ? 3 : 0, gold: 0, fireCd: 0, dodgeCount: 0, kills: 0,
    hits: 0, chests: 0, reborn: false,
  };
  hero.hp = hero.maxHp;
  var monsters = dungeon.monsters.map(function (m) {
    var t = Game.MONSTERS[m.type];
    return { id: m.id, type: m.type, x: m.x, y: m.y, hp: t.hp, maxHp: t.hp, atk: t.atk, def: t.def, awake: false, poison: 0 };
  });
  var items = dungeon.items.map(function (i) { return { id: i.id, type: i.type, x: i.x, y: i.y, taken: false }; });
  var seen = new Int32Array(W * H).fill(-1);
  var frames = [];
  var result = null;
  var turn = 0;
  var events = [];

  function floor(x, y) { return x >= 0 && y >= 0 && x < W && y < H && T[y][x] === 0; }
  function cheb(a, b) { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)); }
  function manh(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
  function alive() { return monsters.filter(function (m) { return m.hp > 0; }); }
  // Belegungskarte: welches Monster steht wo (schnell nachschlagen statt alle Monster durchgehen)
  var occ = new Int32Array(W * H).fill(-1);
  monsters.forEach(function (m, i) { m.idx = i; occ[m.y * W + m.x] = i; });
  function monsterAt(x, y) { var i = occ[y * W + x]; return i >= 0 ? monsters[i] : undefined; }
  function moveMonster(m, x, y) { occ[m.y * W + m.x] = -1; m.x = x; m.y = y; occ[y * W + x] = m.idx; }
  function ev(kind, text, extra) { var e = { kind: kind, text: text }; for (var k in extra || {}) e[k] = extra[k]; events.push(e); }
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  // Dijkstra vom Helden aus (mit Binär-Heap); cost(x,y) liefert Zusatzkosten pro Feld
  var heapD = new Float64Array(W * H * 4), heapI = new Int32Array(W * H * 4);
  function distances(sx, sy, cost) {
    var dist = new Float64Array(W * H).fill(Infinity), prev = new Int32Array(W * H).fill(-1);
    var n = 0;
    function push(d, i) {
      var k = n++;
      while (k > 0) { var p = (k - 1) >> 1; if (heapD[p] <= d) break; heapD[k] = heapD[p]; heapI[k] = heapI[p]; k = p; }
      heapD[k] = d; heapI[k] = i;
    }
    function pop() {
      var top = heapI[0], d = heapD[--n], i = heapI[n], k = 0;
      while (true) {
        var c = 2 * k + 1; if (c >= n) break;
        if (c + 1 < n && heapD[c + 1] < heapD[c]) c++;
        if (heapD[c] >= d) break;
        heapD[k] = heapD[c]; heapI[k] = heapI[c]; k = c;
      }
      heapD[k] = d; heapI[k] = i;
      return top;
    }
    dist[sy * W + sx] = 0; push(0, sy * W + sx);
    while (n > 0) {
      var d0 = heapD[0], cur = pop();
      if (d0 > dist[cur]) continue;
      var x = cur % W, y = (cur - x) / W;
      for (var k = 0; k < 4; k++) {
        var nx = x + DIRS[k][0], ny = y + DIRS[k][1];
        if (!floor(nx, ny)) continue;
        var ni = ny * W + nx, nd = d0 + 1 + (cost ? cost(nx, ny) : 0);
        if (nd < dist[ni]) { dist[ni] = nd; prev[ni] = cur; push(nd, ni); }
      }
    }
    return { dist: dist, prev: prev };
  }
  function firstStep(map, tx, ty) {
    var i = ty * W + tx, start = hero.y * W + hero.x;
    if (map.dist[i] === Infinity || i === start) return null;
    while (map.prev[i] !== start) { i = map.prev[i]; if (i < 0) return null; }
    return { x: i % W, y: Math.floor(i / W) };
  }

  function reveal() {
    for (var y = hero.y - sight; y <= hero.y + sight; y++)
      for (var x = hero.x - sight; x <= hero.x + sight; x++)
        if (x >= 0 && y >= 0 && x < W && y < H && seen[y * W + x] < 0) seen[y * W + x] = turn;
  }

  function snapshot() {
    if (fast) { events = []; return; }
    frames.push({
      turn: turn,
      hero: { x: hero.x, y: hero.y, hp: hero.hp, maxHp: hero.maxHp, atk: hero.atk, def: hero.def, lvl: hero.lvl,
              xp: hero.xp, potions: hero.potions, gold: hero.gold, kills: hero.kills, fireCd: hero.fireCd, sight: sight },
      monsters: alive().map(function (m) { return { id: m.id, type: m.type, x: m.x, y: m.y, hp: m.hp, maxHp: m.maxHp, awake: m.awake }; }),
      items: items.filter(function (i) { return !i.taken; }).map(function (i) { return i.id; }),
      events: events,
    });
    events = [];
  }

  function heroDamage() {
    var d = hero.atk;
    if (has.berserk && hero.hp < hero.maxHp / 2) d = Math.round(d * 1.75);
    return d;
  }
  function hurtMonster(m, dmg, how) {
    m.hp -= dmg;
    m.awake = true;
    ev("hit", how + " " + Game.MONSTERS[m.type].name + ": " + dmg + " Schaden", { x: m.x, y: m.y, amount: dmg, target: "monster" });
    if (m.hp <= 0) {
      occ[m.y * W + m.x] = -1;
      var t = Game.MONSTERS[m.type];
      hero.kills++;
      var xp = tactic === "hunter" ? Math.round(t.xp * 1.15) : t.xp; // Jäger: +15 % Erfahrung
      ev("kill", t.name + " besiegt" + (xp ? " (+" + xp + " EP)" : ""), { x: m.x, y: m.y });
      hero.xp += xp;
      if (has.frenzy && hero.hp > 0) {
        var fh = Math.min(6, hero.maxHp - hero.hp);
        if (fh > 0) { hero.hp += fh; ev("potion", "Siegesrausch: +" + fh + " Leben", { x: hero.x, y: hero.y, amount: fh, target: "hero" }); }
      }
      while (hero.xp >= Game.XP_PER_LEVEL * hero.lvl) {
        hero.xp -= Game.XP_PER_LEVEL * hero.lvl;
        hero.lvl++; hero.maxHp += 6; hero.hp += 6; hero.atk += 1;
        ev("level", "Stufe " + hero.lvl + "! +6 Leben, +1 Angriff", { x: hero.x, y: hero.y });
      }
    }
  }
  function heroAttack(m) {
    var dmg = Math.max(1, heroDamage() + Math.floor(rnd() * 3) - 1 - m.def);
    var ambush = has.stealth && !m.awake;
    if (ambush) dmg *= 3;
    if (has.torch) dmg += 1; // Fackel: Feuerschaden, ignoriert Rüstung
    hero.hits++;
    var crit = has.crit && hero.hits % 3 === 0;
    if (crit) dmg = Math.round(dmg * 2.5);
    if (has.poison && m.hp - dmg > 0) m.poison = 3;
    hurtMonster(m, dmg, ambush ? "Hinterhalt gegen" : crit ? "Kritischer Treffer gegen" : "Schlag gegen");
    if (has.vampire) {
      var heal = Math.max(1, Math.round(dmg * 0.25));
      hero.hp = Math.min(hero.maxHp, hero.hp + heal);
    }
  }

  function pickUp() {
    items.forEach(function (it) {
      if (it.taken || it.x !== hero.x || it.y !== hero.y) return;
      it.taken = true;
      if (it.type === "potion") { hero.potions++; ev("item", "Heiltrank gefunden", { x: hero.x, y: hero.y }); }
      if (it.type === "gold") {
        var g = 5 + Math.floor(rnd() * 11); hero.gold += g; hero.chests++;
        ev("item", "Truhe: " + g + " Gold", { x: hero.x, y: hero.y });
        if (tactic === "balanced" && hero.chests % 3 === 0) { hero.potions++; ev("item", "In der Truhe liegt auch ein Heiltrank", { x: hero.x, y: hero.y }); }
      }
      if (it.type === "sword") { hero.atk += 2; ev("item", "Schwert gefunden: +2 Angriff", { x: hero.x, y: hero.y }); }
      if (it.type === "armor") { hero.def += 1; ev("item", "Schild gefunden: +1 Rüstung", { x: hero.x, y: hero.y }); }
    });
  }

  function heroTurn(extra) {
    if (!extra) {
      if (has.regen && turn % 2 === 0 && hero.hp < hero.maxHp) hero.hp++;
      if (hero.fireCd > 0) hero.fireCd--;
    }

    // 1. Trinken, wenn's knapp wird
    var limit = tactic === "careful" ? 0.5 : 0.35;
    if (hero.potions > 0 && hero.hp < hero.maxHp * limit) {
      hero.potions--;
      var heal = Math.round(hero.maxHp * 0.4);
      hero.hp = Math.min(hero.maxHp, hero.hp + heal);
      ev("potion", "Trinkt Heiltrank: +" + heal + " Leben", { x: hero.x, y: hero.y, amount: heal, target: "hero" });
      return;
    }
    // 2. Feuerball
    if (has.fireball && hero.fireCd === 0) {
      var targets = alive().filter(function (m) { return m.awake && manh(m, hero) <= 5; });
      if (targets.length) {
        targets.sort(function (a, b) { return b.hp - a.hp || a.id - b.id; });
        var t = targets[0];
        hero.fireCd = 5;
        ev("fireball", "Feuerball!", { x: t.x, y: t.y, fromX: hero.x, fromY: hero.y });
        var splash = alive().filter(function (m) { return m !== t && cheb(m, t) <= 1; });
        hurtMonster(t, 12, "Feuerball trifft");
        splash.forEach(function (m) { hurtMonster(m, 5, "Flammen treffen"); });
        return;
      }
    }
    // 3. Nahkampf
    var adj = alive().filter(function (m) { return manh(m, hero) === 1; });
    if (adj.length) {
      adj.sort(function (a, b) { return a.hp - b.hp || a.id - b.id; });
      heroAttack(adj[0]);
      return;
    }
    var awake = alive().filter(function (m) { return m.awake && !Game.MONSTERS[m.type].boss; });
    // Vorsichtig: rasten, solange kein waches Monster in Sicht ist
    if (tactic === "careful" && hero.hp < hero.maxHp &&
        !awake.some(function (m) { return cheb(m, hero) <= Game.SIGHT; })) {
      hero.hp = Math.min(hero.maxHp, hero.hp + 3);
      if (turn % 5 === 0) ev("rest", "Rastet (+3 Leben)", { x: hero.x, y: hero.y });
      return;
    }
    // 4. Bewegen
    var danger = null;
    if (tactic === "careful") {
      danger = new Int32Array(W * H);
      awake.forEach(function (m) {
        for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) {
          var x = m.x + dx, y = m.y + dy;
          if (Math.abs(dx) + Math.abs(dy) <= 2 && x >= 0 && y >= 0 && x < W && y < H) danger[y * W + x] += 6;
        }
      });
    }
    var cost = function (x, y) {
      return (occ[y * W + x] >= 0 ? 3 : 0) + (danger ? danger[y * W + x] : 0);
    };
    var map = distances(hero.x, hero.y, cost);
    var goal = null;
    function nearest(list, maxDist) {
      var best = null, bd = Infinity;
      list.forEach(function (o) { var d = map.dist[o.y * W + o.x]; if (d < bd && d <= maxDist) { bd = d; best = o; } });
      return best;
    }
    var openItems = items.filter(function (i) { return !i.taken; });
    if (tactic === "hunter") {
      var visible = alive().filter(function (m) { return cheb(m, hero) <= Game.SIGHT; });
      goal = nearest(visible, Infinity) || nearest(openItems, 14);
    } else if (tactic === "balanced") {
      goal = nearest(openItems, 8);
    } else {
      goal = nearest(openItems.filter(function (i) { return i.type !== "gold"; }), 5);
    }
    if (!goal) {
      var boss = alive().find(function (m) { return Game.MONSTERS[m.type].boss; });
      goal = boss || dungeon.exit; // der Ausgang öffnet sich erst, wenn der Wächter besiegt ist
    }
    var step = firstStep(map, goal.x, goal.y);
    if (!step) return;
    var blocker = monsterAt(step.x, step.y);
    if (blocker) { heroAttack(blocker); return; }
    hero.x = step.x; hero.y = step.y;
    pickUp();
  }

  // Unruhe: Wer trödelt, bekommt Besuch. Ab Zug UNREST.start alle UNREST.every Züge ein wacher Wanderer.
  function unrest() {
    var U = Game.UNREST, start = U.start + (has.stealth ? 60 : 0);
    if (turn < start || (turn - start) % U.every !== 0) return;
    var wave = (turn - start) / U.every;
    var type = U.types[Math.min(wave, U.types.length - 1)];
    var spots = [];
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++)
      if (T[y][x] === 0 && occ[y * W + x] < 0 && Math.max(Math.abs(x - hero.x), Math.abs(y - hero.y)) >= 8 &&
          !(x === dungeon.exit.x && y === dungeon.exit.y)) spots.push([x, y]);
    if (!spots.length) return;
    var s = spots[Math.floor(spawnRnd() * spots.length)], t = Game.MONSTERS[type];
    var m = { id: monsters.length, idx: monsters.length, type: type, x: s[0], y: s[1], hp: t.hp, maxHp: t.hp, atk: t.atk, def: t.def, awake: true, poison: 0 };
    monsters.push(m);
    occ[m.y * W + m.x] = m.idx;
    ev("unrest", "Der Dungeon wird unruhig: " + t.name + " streift umher.", { x: m.x, y: m.y });
  }

  function monstersTurn() {
    var heroMap = null; // Wegkarte zum Helden, nur berechnen, wenn ein waches Monster laufen will
    alive().forEach(function (m) {
      if (hero.hp <= 0) return;
      var t = Game.MONSTERS[m.type];
      if (m.poison > 0) {
        m.poison--;
        hurtMonster(m, 3, "Gift zehrt an");
        if (m.hp <= 0) return;
      }
      var notice = t.boss ? (has.stealth ? 1 : 3) : (has.stealth ? 0 : 5); // Schleichen: Schläfer wachen nur durch Angriffe auf
      if (!m.awake && cheb(m, hero) <= notice) {
        m.awake = true;
        if (t.boss) ev("wake", "Der Höhlenwächter erhebt sich! Erst wenn er fällt, öffnet sich der Ausgang.", { x: m.x, y: m.y });
      }
      if (!m.awake) return;
      if (manh(m, hero) === 1) {
        if (has.dodge) {
          hero.dodgeCount++;
          if (hero.dodgeCount % 4 === 0) { ev("dodge", "Ausgewichen! (" + t.name + ")", { x: hero.x, y: hero.y }); return; }
        }
        var raw = m.atk + Math.floor(rnd() * 3) - 1;
        var dmg = Math.max(Math.ceil(raw * 0.4), raw - hero.def); // Rüstung fängt höchstens 60 % ab
        if (has.torch && (m.type === "skeleton" || m.type === "rat")) dmg = Math.max(1, Math.round(dmg / 2)); // fürchten das Licht
        hero.hp -= dmg;
        ev("hurt", t.name + " trifft dich: " + dmg + " Schaden", { x: hero.x, y: hero.y, amount: dmg, target: "hero" });
        if (has.thorns) hurtMonster(m, 3, "Dornen stechen");
        if (hero.hp <= 0 && has.phoenix && !hero.reborn) {
          hero.reborn = true;
          hero.hp = Math.round(hero.maxHp * 0.5);
          ev("phoenix", "Die Phönixfeder verglüht: wiederbelebt mit " + hero.hp + " Leben!", { x: hero.x, y: hero.y, amount: hero.hp, target: "hero" });
        } else if (hero.hp <= 0) { hero.hp = 0; result = { won: false, turn: turn, killer: t.name }; ev("death", "Getötet von: " + t.name, { x: hero.x, y: hero.y }); }
        return;
      }
      if (t.boss) return; // der Wächter verlässt seinen Posten nicht
      if (!heroMap) heroMap = distances(hero.x, hero.y, null);
      var best = null, bd = heroMap.dist[m.y * W + m.x];
      DIRS.forEach(function (d) {
        var nx = m.x + d[0], ny = m.y + d[1];
        if (!floor(nx, ny) || monsterAt(nx, ny) || (nx === hero.x && ny === hero.y)) return;
        var nd = heroMap.dist[ny * W + nx];
        if (nd < bd) { bd = nd; best = { x: nx, y: ny }; }
      });
      if (best) moveMonster(m, best.x, best.y);
    });
  }

  reveal();
  ev("start", "Der Held betritt den Dungeon.", { x: hero.x, y: hero.y });
  snapshot();
  while (!result && turn < Game.MAX_TURNS) {
    turn++;
    heroTurn(false);
    if (has.swift && turn % 3 === 0 && !result) heroTurn(true); // Flink: jeder 3. Zug doppelt
    var bossAlive = alive().some(function (m) { return Game.MONSTERS[m.type].boss; });
    if (!bossAlive && hero.x === dungeon.exit.x && hero.y === dungeon.exit.y) {
      result = { won: true, turn: turn };
      ev("win", "Ausgang erreicht! Dungeon geschafft!", { x: hero.x, y: hero.y });
    } else {
      unrest();
      monstersTurn();
    }
    reveal();
    snapshot();
  }
  if (!result) result = { won: false, turn: turn, killer: null, timeout: true };
  result.lvl = hero.lvl; result.kills = hero.kills; result.hp = hero.hp; result.maxHp = hero.maxHp;
  return { frames: frames, result: result, seen: seen };
};
