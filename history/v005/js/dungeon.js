// Zufallszahlen mit festem Startwert (gleicher Seed = gleicher Dungeon) und Dungeon-Erzeugung.
var Game = (typeof window !== "undefined" ? window : globalThis).Game || ((typeof window !== "undefined" ? window : globalThis).Game = {});

Game.rng = function (seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

Game.W = 40;
Game.H = 26;

Game.generateDungeon = function (seed) {
  var W = Game.W, H = Game.H, rnd = Game.rng(seed);
  var ri = function (a, b) { return a + Math.floor(rnd() * (b - a + 1)); };
  var tiles = [];
  for (var y = 0; y < H; y++) { tiles.push([]); for (var x = 0; x < W; x++) tiles[y].push(1); } // 1 = Wand

  // Räume verteilen
  var rooms = [];
  for (var tries = 0; tries < 300 && rooms.length < 9; tries++) {
    var w = ri(4, 8), h = ri(3, 6);
    var r = { x: ri(1, W - w - 2), y: ri(1, H - h - 2), w: w, h: h };
    var overlaps = rooms.some(function (o) {
      return r.x - 1 < o.x + o.w && r.x + r.w + 1 > o.x && r.y - 1 < o.y + o.h && r.y + r.h + 1 > o.y;
    });
    if (!overlaps) rooms.push(r);
  }
  rooms.forEach(function (r) {
    for (var y = r.y; y < r.y + r.h; y++) for (var x = r.x; x < r.x + r.w; x++) tiles[y][x] = 0;
    r.cx = r.x + Math.floor(r.w / 2);
    r.cy = r.y + Math.floor(r.h / 2);
  });

  // Räume der Reihe nach (von links nach rechts) mit L-förmigen Gängen verbinden
  rooms.sort(function (a, b) { return a.cx - b.cx; });
  function carve(x1, y1, x2, y2) {
    var x = x1, y = y1;
    var horizontalFirst = rnd() < 0.5;
    function step() { tiles[y][x] = 0; }
    step();
    if (horizontalFirst) {
      while (x !== x2) { x += x2 > x ? 1 : -1; step(); }
      while (y !== y2) { y += y2 > y ? 1 : -1; step(); }
    } else {
      while (y !== y2) { y += y2 > y ? 1 : -1; step(); }
      while (x !== x2) { x += x2 > x ? 1 : -1; step(); }
    }
  }
  for (var i = 1; i < rooms.length; i++) carve(rooms[i - 1].cx, rooms[i - 1].cy, rooms[i].cx, rooms[i].cy);
  // ein paar Querverbindungen, damit es Umwege gibt
  for (var k = 0; k < 2; k++) {
    var a = ri(0, rooms.length - 3);
    carve(rooms[a].cx, rooms[a].cy, rooms[a + 2].cx, rooms[a + 2].cy);
  }

  var start = rooms[0], exitRoom = rooms[rooms.length - 1];
  var dungeon = {
    seed: seed, w: W, h: H, tiles: tiles, rooms: rooms,
    start: { x: start.cx, y: start.cy },
    exit: { x: exitRoom.x + exitRoom.w - 1, y: exitRoom.cy },
    monsters: [], items: [],
  };

  var used = {};
  function key(x, y) { return x + "," + y; }
  used[key(dungeon.start.x, dungeon.start.y)] = 1;
  used[key(dungeon.exit.x, dungeon.exit.y)] = 1;
  used[key(dungeon.exit.x - 1, dungeon.exit.y)] = 1; // Platz des Wächters
  function freeSpot(r) {
    for (var t = 0; t < 50; t++) {
      var x = ri(r.x, r.x + r.w - 1), y = ri(r.y, r.y + r.h - 1);
      if (!used[key(x, y)]) { used[key(x, y)] = 1; return { x: x, y: y }; }
    }
    return null;
  }

  // Monster: je weiter vom Start, desto gefährlicher
  var id = 0;
  rooms.forEach(function (r, idx) {
    if (idx === 0) return;
    var depth = idx / (rooms.length - 1); // 0..1
    var pool = depth < 0.3 ? ["rat", "rat", "goblin"]
      : depth < 0.6 ? ["goblin", "goblin", "skeleton", "rat"]
      : ["skeleton", "orc", "goblin", "orc"];
    // Gefahrenbudget pro Raum: wächst mit der Tiefe, damit alle Dungeons ähnlich schwer sind
    var budget = idx === rooms.length - 1 ? 2 : Math.round(2 + depth * 7);
    for (var m = 0; m < 4 && budget > 0; m++) {
      var fits = pool.filter(function (t) { return Game.MONSTERS[t].threat <= budget; });
      if (!fits.length) break;
      var type = fits[ri(0, fits.length - 1)];
      var p = freeSpot(r);
      if (!p) break;
      dungeon.monsters.push({ id: id++, type: type, x: p.x, y: p.y });
      budget -= Game.MONSTERS[type].threat;
    }
    // Gegenstände
    if (rnd() < 0.55) { var g = freeSpot(r); if (g) dungeon.items.push({ id: "i" + idx + "g", type: "gold", x: g.x, y: g.y }); }
    if (rnd() < 0.35) { var q = freeSpot(r); if (q) dungeon.items.push({ id: "i" + idx + "p", type: "potion", x: q.x, y: q.y }); }
  });
  // je ein Schwert und ein Rüstungsteil in der Mitte des Dungeons
  var mid = rooms[Math.floor(rooms.length / 2)], mid2 = rooms[Math.floor(rooms.length / 2) - 1] || mid;
  var s = freeSpot(mid); if (s) dungeon.items.push({ id: "sword", type: "sword", x: s.x, y: s.y });
  var ar = freeSpot(mid2); if (ar) dungeon.items.push({ id: "armor", type: "armor", x: ar.x, y: ar.y });
  // der Wächter steht vor dem Ausgang
  dungeon.monsters.push({ id: id++, type: "boss", x: dungeon.exit.x - 1, y: dungeon.exit.y });
  return dungeon;
};
