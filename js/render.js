// Zeichnet einen Frame der Simulation auf das Canvas.
var Game = window.Game || (window.Game = {});

Game.TILE = 20;

Game.render = function (ctx, dungeon, sim, frame, since) {
  var S = Game.TILE, W = dungeon.w, H = dungeon.h;
  var hero = frame.hero, turn = frame.turn;
  ctx.fillStyle = "#07060c";
  ctx.fillRect(0, 0, W * S, H * S);

  function inSight(x, y) { return Math.max(Math.abs(x - hero.x), Math.abs(y - hero.y)) <= Game.SIGHT; }
  function seen(x, y) { var t = sim.seen[y * W + x]; return t >= 0 && t <= turn; }

  // Boden und Wände
  for (var y = 0; y < H; y++) {
    for (var x = 0; x < W; x++) {
      if (!seen(x, y)) continue;
      var wall = dungeon.tiles[y][x] === 1;
      var lit = inSight(x, y);
      if (wall) {
        var nearFloor = false;
        for (var dy = -1; dy <= 1 && !nearFloor; dy++) for (var dx = -1; dx <= 1; dx++) {
          var nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < W && ny < H && dungeon.tiles[ny][nx] === 0) { nearFloor = true; break; }
        }
        if (!nearFloor) continue;
        ctx.fillStyle = lit ? "#4a4266" : "#2a2540";
        ctx.fillRect(x * S, y * S, S, S);
        ctx.fillStyle = lit ? "#5d5480" : "#332d4d";
        ctx.fillRect(x * S, y * S, S, 4);
      } else {
        ctx.fillStyle = lit ? ((x + y) % 2 ? "#262236" : "#2a2640") : "#16141f";
        ctx.fillRect(x * S, y * S, S, S);
      }
    }
  }

  // Ausgang
  var ex = dungeon.exit;
  if (seen(ex.x, ex.y)) {
    var bossAlive = frame.monsters.some(function (m) { return Game.MONSTERS[m.type].boss; });
    ctx.fillStyle = bossAlive ? "#5a2a2a" : "#2ecc71";
    for (var i = 0; i < 4; i++) ctx.fillRect(ex.x * S + 3 + i * 3, ex.y * S + 3 + i * 4, S - 6 - i * 6 > 2 ? S - 6 - i * 3 : 3, 3);
    if (!bossAlive && inSight(ex.x, ex.y)) {
      ctx.strokeStyle = "rgba(46,204,113," + (0.4 + 0.3 * Math.sin(performance.now() / 200)) + ")";
      ctx.lineWidth = 2;
      ctx.strokeRect(ex.x * S + 1, ex.y * S + 1, S - 2, S - 2);
    }
  }

  // Gegenstände
  var present = {};
  frame.items.forEach(function (id) { present[id] = true; });
  dungeon.items.forEach(function (it) {
    if (!present[it.id] || !seen(it.x, it.y)) return;
    var cx = it.x * S + S / 2, cy = it.y * S + S / 2;
    ctx.globalAlpha = inSight(it.x, it.y) ? 1 : 0.5;
    if (it.type === "gold") {
      ctx.fillStyle = "#f1c40f"; ctx.beginPath(); ctx.arc(cx - 2, cy + 2, 4, 0, 7); ctx.arc(cx + 3, cy, 4, 0, 7); ctx.fill();
    } else if (it.type === "potion") {
      ctx.fillStyle = "#e74c6f"; ctx.beginPath(); ctx.arc(cx, cy + 2, 5, 0, 7); ctx.fill();
      ctx.fillStyle = "#ddd"; ctx.fillRect(cx - 2, cy - 7, 4, 5);
    } else if (it.type === "sword") {
      ctx.strokeStyle = "#9ecbff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - 6, cy + 6); ctx.lineTo(cx + 6, cy - 6); ctx.stroke();
      ctx.strokeStyle = "#c9a227"; ctx.beginPath(); ctx.moveTo(cx - 6, cy); ctx.lineTo(cx, cy + 6); ctx.stroke();
    } else if (it.type === "armor") {
      ctx.fillStyle = "#a0a0b8"; ctx.beginPath(); ctx.moveTo(cx - 6, cy - 6); ctx.lineTo(cx + 6, cy - 6); ctx.lineTo(cx + 5, cy + 2); ctx.lineTo(cx, cy + 7); ctx.lineTo(cx - 5, cy + 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  });

  // Monster (nur in Sichtweite)
  frame.monsters.forEach(function (m) {
    if (!inSight(m.x, m.y)) return;
    var t = Game.MONSTERS[m.type];
    var cx = m.x * S + S / 2, cy = m.y * S + S / 2, r = t.boss ? S * 0.62 : S * 0.4;
    ctx.fillStyle = t.color;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
    ctx.fillStyle = "#111";
    ctx.font = "bold " + (t.boss ? 15 : 12) + "px system-ui, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(m.awake ? t.letter : "z", cx, cy + 1);
    if (m.hp < m.maxHp) bar(m.x * S + 2, m.y * S - 3, S - 4, m.hp / m.maxHp, "#e74c3c");
  });

  // Held
  var hx = hero.x * S + S / 2, hy = hero.y * S + S / 2;
  if (hero.hp > 0) {
    ctx.fillStyle = "#ffd166";
    ctx.beginPath(); ctx.arc(hx, hy, S * 0.42, 0, 7); ctx.fill();
    ctx.fillStyle = "#3b2f12";
    ctx.fillRect(hx - 4, hy - 3, 3, 3); ctx.fillRect(hx + 1, hy - 3, 3, 3);
  } else {
    ctx.strokeStyle = "#ff5d5d"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(hx - 6, hy - 6); ctx.lineTo(hx + 6, hy + 6); ctx.moveTo(hx + 6, hy - 6); ctx.lineTo(hx - 6, hy + 6); ctx.stroke();
  }
  bar(hero.x * S + 1, hero.y * S - 4, S - 2, hero.hp / hero.maxHp, "#2ecc71");

  // Effekte dieses Zugs (blenden aus)
  var age = Math.min(1, (performance.now() - since) / 700);
  ctx.globalAlpha = 1 - age;
  frame.events.forEach(function (e, i) {
    var ex = e.x * S + S / 2, ey = e.y * S + S / 2;
    if (e.kind === "fireball") {
      ctx.strokeStyle = "#ff9f1c"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(e.fromX * S + S / 2, e.fromY * S + S / 2); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = "rgba(255,120,30,0.5)"; ctx.beginPath(); ctx.arc(ex, ey, S * 1.5, 0, 7); ctx.fill();
    }
    if (e.amount) {
      var heal = e.kind === "potion";
      ctx.fillStyle = heal ? "#7dff9b" : e.target === "hero" ? "#ff6b6b" : "#ffffff";
      ctx.font = "bold 14px system-ui, sans-serif"; ctx.textAlign = "center";
      ctx.fillText((heal ? "+" : "−") + e.amount, ex + (i % 2 ? 6 : -6), ey - 12 - age * 14);
    }
    if (e.kind === "level") {
      ctx.fillStyle = "#ffd166"; ctx.font = "bold 13px system-ui, sans-serif"; ctx.textAlign = "center";
      ctx.fillText("STUFE " + hero.lvl, ex, ey - 26 - age * 10);
    }
  });
  ctx.globalAlpha = 1;

  function bar(x, y, w, frac, color) {
    ctx.fillStyle = "#000"; ctx.fillRect(x, y, w, 3);
    ctx.fillStyle = color; ctx.fillRect(x, y, Math.max(0, w * frac), 3);
  }
};
