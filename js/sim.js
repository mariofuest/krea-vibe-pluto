// Die Simulation: spielt den ganzen Lauf im Voraus durch und speichert jeden Zug als "Frame".
// Gleicher Dungeon + gleicher Build = immer exakt derselbe Ablauf.
var Game = (typeof window !== "undefined" ? window : globalThis).Game || ((typeof window !== "undefined" ? window : globalThis).Game = {});

Game.MAX_TURNS = 900;
Game.SIGHT = 6;

Game.simulate = function (dungeon, build) {
  var W = dungeon.w, H = dungeon.h, T = dungeon.tiles;
  var rnd = Game.rng(dungeon.seed * 7919 + 17);
  var has = {};
  build.abilities.forEach(function (a) { has[a] = true; });
  var stat = function (id) {
    var s = Game.STATS.find(function (x) { return x.id === id; });
    return s.base + s.per * (build.stats[id] || 0);
  };
  var tactic = build.tactic;

  var hero = {
    x: dungeon.start.x, y: dungeon.start.y, maxHp: stat("hp"), atk: stat("atk"), def: stat("def"),
    lvl: 1, xp: 0, potions: has.potions ? 3 : 0, gold: 0, fireCd: 0, dodgeCount: 0, kills: 0,
  };
  hero.hp = hero.maxHp;
  var monsters = dungeon.monsters.map(function (m) {
    var t = Game.MONSTERS[m.type];
    return { id: m.id, type: m.type, x: m.x, y: m.y, hp: t.hp, maxHp: t.hp, atk: t.atk, def: t.def, awake: false };
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
  function monsterAt(x, y) { return monsters.find(function (m) { return m.hp > 0 && m.x === x && m.y === y; }); }
  function ev(kind, text, extra) { var e = { kind: kind, text: text }; for (var k in extra || {}) e[k] = extra[k]; events.push(e); }
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  // Dijkstra vom Helden aus; cost(x,y) liefert Zusatzkosten pro Feld
  function distances(sx, sy, cost) {
    var dist = new Float64Array(W * H).fill(Infinity), prev = new Int32Array(W * H).fill(-1);
    var open = [[0, sx, sy]];
    dist[sy * W + sx] = 0;
    while (open.length) {
      var best = 0;
      for (var i = 1; i < open.length; i++) if (open[i][0] < open[best][0]) best = i;
      var cur = open[best]; open[best] = open[open.length - 1]; open.pop();
      var d = cur[0], x = cur[1], y = cur[2];
      if (d > dist[y * W + x]) continue;
      for (var k = 0; k < 4; k++) {
        var nx = x + DIRS[k][0], ny = y + DIRS[k][1];
        if (!floor(nx, ny)) continue;
        var nd = d + 1 + (cost ? cost(nx, ny) : 0);
        if (nd < dist[ny * W + nx]) { dist[ny * W + nx] = nd; prev[ny * W + nx] = y * W + x; open.push([nd, nx, ny]); }
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
    for (var y = hero.y - Game.SIGHT; y <= hero.y + Game.SIGHT; y++)
      for (var x = hero.x - Game.SIGHT; x <= hero.x + Game.SIGHT; x++)
        if (x >= 0 && y >= 0 && x < W && y < H && seen[y * W + x] < 0) seen[y * W + x] = turn;
  }

  function snapshot() {
    frames.push({
      turn: turn,
      hero: { x: hero.x, y: hero.y, hp: hero.hp, maxHp: hero.maxHp, atk: hero.atk, def: hero.def, lvl: hero.lvl,
              xp: hero.xp, potions: hero.potions, gold: hero.gold, kills: hero.kills, fireCd: hero.fireCd },
      monsters: alive().map(function (m) { return { id: m.id, type: m.type, x: m.x, y: m.y, hp: m.hp, maxHp: m.maxHp, awake: m.awake }; }),
      items: items.filter(function (i) { return !i.taken; }).map(function (i) { return i.id; }),
      events: events,
    });
    events = [];
  }

  function heroDamage() {
    var d = hero.atk;
    if (has.berserk && hero.hp < hero.maxHp / 2) d = Math.round(d * 1.5);
    return d;
  }
  function hurtMonster(m, dmg, how) {
    m.hp -= dmg;
    m.awake = true;
    ev("hit", how + " " + Game.MONSTERS[m.type].name + ": " + dmg + " Schaden", { x: m.x, y: m.y, amount: dmg, target: "monster" });
    if (m.hp <= 0) {
      var t = Game.MONSTERS[m.type];
      hero.kills++;
      ev("kill", t.name + " besiegt" + (t.xp ? " (+" + t.xp + " EP)" : ""), { x: m.x, y: m.y });
      hero.xp += t.xp;
      while (hero.xp >= Game.XP_PER_LEVEL * hero.lvl) {
        hero.xp -= Game.XP_PER_LEVEL * hero.lvl;
        hero.lvl++; hero.maxHp += 6; hero.hp += 6; hero.atk += 1;
        ev("level", "Stufe " + hero.lvl + "! +6 Leben, +1 Angriff", { x: hero.x, y: hero.y });
      }
    }
  }
  function heroAttack(m) {
    var dmg = Math.max(1, heroDamage() + Math.floor(rnd() * 3) - 1 - m.def);
    hurtMonster(m, dmg, "Schlag gegen");
    if (has.vampire) {
      var heal = Math.max(1, Math.round(dmg * 0.3));
      hero.hp = Math.min(hero.maxHp, hero.hp + heal);
    }
  }

  function pickUp() {
    items.forEach(function (it) {
      if (it.taken || it.x !== hero.x || it.y !== hero.y) return;
      it.taken = true;
      if (it.type === "potion") { hero.potions++; ev("item", "Heiltrank gefunden", { x: hero.x, y: hero.y }); }
      if (it.type === "gold") { var g = 5 + Math.floor(rnd() * 11); hero.gold += g; ev("item", g + " Gold gefunden", { x: hero.x, y: hero.y }); }
      if (it.type === "sword") { hero.atk += 2; ev("item", "Schwert gefunden: +2 Angriff", { x: hero.x, y: hero.y }); }
      if (it.type === "armor") { hero.def += 1; ev("item", "Rüstungsteil gefunden: +1 Rüstung", { x: hero.x, y: hero.y }); }
    });
  }

  function heroTurn() {
    if (has.regen && turn % 3 === 0 && hero.hp < hero.maxHp) hero.hp++;
    if (hero.fireCd > 0) hero.fireCd--;

    // 1. Trinken, wenn's knapp wird
    var limit = tactic === "careful" ? 0.5 : 0.35;
    if (hero.potions > 0 && hero.hp < hero.maxHp * limit) {
      hero.potions--;
      var heal = Math.round(hero.maxHp * 0.5);
      hero.hp = Math.min(hero.maxHp, hero.hp + heal);
      ev("potion", "Trinkt Heiltrank: +" + heal + " Leben", { x: hero.x, y: hero.y, amount: heal, target: "hero" });
      return;
    }
    // 2. Feuerball
    if (has.fireball && hero.fireCd === 0) {
      var targets = alive().filter(function (m) { return m.awake && manh(m, hero) <= 4; });
      if (targets.length) {
        targets.sort(function (a, b) { return b.hp - a.hp || a.id - b.id; });
        var t = targets[0];
        hero.fireCd = 5;
        ev("fireball", "Feuerball!", { x: t.x, y: t.y, fromX: hero.x, fromY: hero.y });
        var splash = alive().filter(function (m) { return m !== t && cheb(m, t) <= 1; });
        hurtMonster(t, 8, "Feuerball trifft");
        splash.forEach(function (m) { hurtMonster(m, 4, "Flammen treffen"); });
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
    // 4. Bewegen
    var awake = alive().filter(function (m) { return m.awake && !Game.MONSTERS[m.type].boss; });
    var cost = function (x, y) {
      var c = monsterAt(x, y) ? 3 : 0;
      if (tactic === "careful") awake.forEach(function (m) { if (Math.abs(m.x - x) + Math.abs(m.y - y) <= 2) c += 6; });
      return c;
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

  function monstersTurn() {
    var heroMap = distances(hero.x, hero.y, null);
    alive().forEach(function (m) {
      if (hero.hp <= 0) return;
      var t = Game.MONSTERS[m.type];
      var notice = t.boss ? 3 : (has.stealth ? 2 : 5);
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
        var dmg = Math.max(1, m.atk + Math.floor(rnd() * 3) - 1 - hero.def);
        hero.hp -= dmg;
        ev("hurt", t.name + " trifft dich: " + dmg + " Schaden", { x: hero.x, y: hero.y, amount: dmg, target: "hero" });
        if (has.thorns) hurtMonster(m, 3, "Dornen stechen");
        if (hero.hp <= 0) { hero.hp = 0; result = { won: false, turn: turn, killer: t.name }; ev("death", "Getötet von: " + t.name, { x: hero.x, y: hero.y }); }
        return;
      }
      if (t.boss) return; // der Wächter verlässt seinen Posten nicht
      var best = null, bd = heroMap.dist[m.y * W + m.x];
      DIRS.forEach(function (d) {
        var nx = m.x + d[0], ny = m.y + d[1];
        if (!floor(nx, ny) || monsterAt(nx, ny) || (nx === hero.x && ny === hero.y)) return;
        var nd = heroMap.dist[ny * W + nx];
        if (nd < bd) { bd = nd; best = { x: nx, y: ny }; }
      });
      if (best) { m.x = best.x; m.y = best.y; }
    });
  }

  reveal();
  ev("start", "Der Held betritt den Dungeon.", { x: hero.x, y: hero.y });
  snapshot();
  while (!result && turn < Game.MAX_TURNS) {
    turn++;
    heroTurn();
    var bossAlive = alive().some(function (m) { return Game.MONSTERS[m.type].boss; });
    if (!bossAlive && hero.x === dungeon.exit.x && hero.y === dungeon.exit.y) {
      result = { won: true, turn: turn };
      ev("win", "Ausgang erreicht! Dungeon geschafft!", { x: hero.x, y: hero.y });
    } else {
      monstersTurn();
    }
    reveal();
    snapshot();
  }
  if (!result) result = { won: false, turn: turn, killer: null, timeout: true };
  return { frames: frames, result: result, seen: seen };
};
