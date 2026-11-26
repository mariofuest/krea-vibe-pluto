// Zeichnet einen Frame der Simulation auf das Canvas.
// Grafik: Kenney "Tiny Dungeon" (CC0), assets/tiny-dungeon.png, 12 × 11 Kacheln à 16 px.
var Game = window.Game || (window.Game = {});

Game.TILE = 16;
Game.sheet = new Image();
Game.sheet.src = "assets/tiny-dungeon.png";
Game.SPRITES = {
  floor: [48, 49], wall: 40, doorLocked: 45, doorOpen: 9,
  hero: 97, rat: 123, goblin: 109, skeleton: 121, orc: 112, boss: 110,
  potion: 115, gold: 89, sword: 104, armor: 102,
};

Game.render = function (ctx, dungeon, sim, frame, since) {
  var S = Game.TILE, W = dungeon.w, H = dungeon.h, SP = Game.SPRITES;
  var hero = frame.hero, turn = frame.turn;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#07060c";
  ctx.fillRect(0, 0, W * S, H * S);
  if (!Game.sheet.complete || !Game.sheet.naturalWidth) return;

  function spr(i, x, y, size) {
    size = size || S;
    var off = (size - S) / 2;
    ctx.drawImage(Game.sheet, (i % 12) * 16, Math.floor(i / 12) * 16, 16, 16, x * S - off, y * S - off * 1.5, size, size);
  }
  function inSight(x, y) { return Math.max(Math.abs(x - hero.x), Math.abs(y - hero.y)) <= Game.SIGHT; }
  function seen(x, y) { var t = sim.seen[y * W + x]; return t >= 0 && t <= turn; }

  // Boden und Wände (nur Wände, die an Boden grenzen)
  for (var y = 0; y < H; y++) {
    for (var x = 0; x < W; x++) {
      if (!seen(x, y)) continue;
      if (dungeon.tiles[y][x] === 1) {
        var nearFloor = false;
        for (var dy = -1; dy <= 1 && !nearFloor; dy++) for (var dx = -1; dx <= 1; dx++) {
          var nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < W && ny < H && dungeon.tiles[ny][nx] === 0) { nearFloor = true; break; }
        }
        if (nearFloor) spr(SP.wall, x, y);
      } else {
        ctx.globalAlpha = 0.55; // Sandboden abdunkeln, damit es nach Dungeon aussieht
        spr(SP.floor[(x * 7 + y * 13) % 5 === 0 ? 1 : 0], x, y);
        ctx.globalAlpha = 1;
      }
    }
  }

  // Ausgang
  var ex = dungeon.exit;
  var bossAlive = frame.monsters.some(function (m) { return Game.MONSTERS[m.type].boss; });
  if (seen(ex.x, ex.y)) {
    spr(bossAlive ? SP.doorLocked : SP.doorOpen, ex.x, ex.y);
    if (!bossAlive) {
      ctx.strokeStyle = "rgba(46,204,113," + (0.5 + 0.4 * Math.sin(performance.now() / 200)) + ")";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(ex.x * S + 0.5, ex.y * S + 0.5, S - 1, S - 1);
    }
  }

  // Gegenstände
  var present = {};
  frame.items.forEach(function (id) { present[id] = true; });
  dungeon.items.forEach(function (it) {
    if (present[it.id] && seen(it.x, it.y)) spr(SP[it.type], it.x, it.y);
  });

  // Nebel über allem, was gerade nicht in Sicht ist
  ctx.fillStyle = "rgba(7,6,12,0.6)";
  for (var y2 = 0; y2 < H; y2++) for (var x2 = 0; x2 < W; x2++)
    if (seen(x2, y2) && !inSight(x2, y2)) ctx.fillRect(x2 * S, y2 * S, S, S);

  // Monster (nur in Sichtweite)
  frame.monsters.forEach(function (m) {
    if (!inSight(m.x, m.y)) return;
    var boss = Game.MONSTERS[m.type].boss;
    ctx.globalAlpha = m.awake ? 1 : 0.75;
    spr(SP[m.type], m.x, m.y, boss ? 26 : S);
    ctx.globalAlpha = 1;
    if (!m.awake) {
      ctx.fillStyle = "#cfd8ff"; ctx.font = "bold 7px system-ui, sans-serif"; ctx.textAlign = "left";
      ctx.fillText("z", m.x * S + S - 4, m.y * S + 4);
    }
    if (m.hp < m.maxHp) bar(m.x * S + 1, m.y * S - (boss ? 9 : 3), S - 2, m.hp / m.maxHp, "#e74c3c");
  });

  // Held
  if (hero.hp > 0) spr(SP.hero, hero.x, hero.y);
  else {
    ctx.globalAlpha = 0.5; spr(SP.hero, hero.x, hero.y); ctx.globalAlpha = 1;
    ctx.strokeStyle = "#ff5d5d"; ctx.lineWidth = 2;
    var hx = hero.x * S, hy = hero.y * S;
    ctx.beginPath(); ctx.moveTo(hx + 2, hy + 2); ctx.lineTo(hx + S - 2, hy + S - 2); ctx.moveTo(hx + S - 2, hy + 2); ctx.lineTo(hx + 2, hy + S - 2); ctx.stroke();
  }
  bar(hero.x * S + 1, hero.y * S - 3, S - 2, hero.hp / hero.maxHp, "#2ecc71");

  // Effekte dieses Zugs (blenden aus)
  var age = Math.min(1, (performance.now() - since) / 700);
  ctx.globalAlpha = 1 - age;
  frame.events.forEach(function (e, i) {
    var cx = e.x * S + S / 2, cy = e.y * S + S / 2;
    if (e.kind === "fireball") {
      ctx.strokeStyle = "#ff9f1c"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(e.fromX * S + S / 2, e.fromY * S + S / 2); ctx.lineTo(cx, cy); ctx.stroke();
      ctx.fillStyle = "rgba(255,120,30,0.45)"; ctx.beginPath(); ctx.arc(cx, cy, S * 1.5, 0, 7); ctx.fill();
    }
    if (e.amount) {
      var heal = e.kind === "potion";
      ctx.fillStyle = heal ? "#7dff9b" : e.target === "hero" ? "#ff6b6b" : "#ffffff";
      ctx.strokeStyle = "#000"; ctx.lineWidth = 2;
      ctx.font = "bold 10px system-ui, sans-serif"; ctx.textAlign = "center";
      var txt = (heal ? "+" : "−") + e.amount, tx = cx + (i % 2 ? 5 : -5), ty = cy - 9 - age * 10;
      ctx.strokeText(txt, tx, ty); ctx.fillText(txt, tx, ty);
    }
    if (e.kind === "level") {
      ctx.fillStyle = "#ffd166"; ctx.font = "bold 9px system-ui, sans-serif"; ctx.textAlign = "center";
      ctx.fillText("STUFE " + hero.lvl, cx, cy - 20 - age * 8);
    }
  });
  ctx.globalAlpha = 1;

  function bar(x, y, w, frac, color) {
    ctx.fillStyle = "#000"; ctx.fillRect(x, y, w, 2);
    ctx.fillStyle = color; ctx.fillRect(x, y, Math.max(0, w * frac), 2);
  }
};
