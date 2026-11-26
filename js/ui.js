// Auswahl-Bildschirm (Punkte verteilen) und Abspiel-Steuerung.
var Game = window.Game || (window.Game = {});

Game.ui = (function () {
  var $ = function (id) { return document.getElementById(id); };
  var build, dungeon, sim, idx = 0, playing = false, speed = 4, acc = 0, lastT = 0, frameSince = 0;
  var attempts = [];
  var SPEEDS = [2, 4, 8, 16, 60];

  function load(key, fallback) { try { var v = JSON.parse(localStorage.getItem(key)); return v || fallback; } catch (e) { return fallback; } }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }

  // ---------- Auswahl ----------
  function renderSetup() {
    var spent = Game.buildCost(build), left = Game.BUDGET - spent;
    $("points").textContent = left;
    $("points").parentElement.classList.toggle("empty", left === 0);

    $("stats").innerHTML = "";
    Game.STATS.forEach(function (s) {
      var v = build.stats[s.id] || 0;
      var row = document.createElement("div");
      row.className = "stat";
      row.innerHTML = '<div><b></b> <span class="val"></span><small></small></div>' +
        '<div class="pips"></div><button class="minus" aria-label="weniger">−</button><button class="plus" aria-label="mehr">+</button>';
      row.querySelector("b").textContent = s.name;
      row.querySelector(".val").textContent = s.base + s.per * v;
      row.querySelector("small").textContent = s.desc;
      var pips = row.querySelector(".pips");
      for (var i = 0; i < s.max; i++) { var p = document.createElement("i"); if (i < v) p.className = "on"; pips.appendChild(p); }
      row.querySelector(".minus").disabled = v <= 0;
      row.querySelector(".plus").disabled = v >= s.max || left <= 0;
      row.querySelector(".minus").onclick = function () { build.stats[s.id]--; changed(); };
      row.querySelector(".plus").onclick = function () { build.stats[s.id] = v + 1; changed(); };
      $("stats").appendChild(row);
    });

    $("abilities").innerHTML = "";
    Game.ABILITIES.forEach(function (a) {
      var on = build.abilities.indexOf(a.id) >= 0;
      var b = document.createElement("button");
      b.className = "ability" + (on ? " on" : "");
      b.disabled = !on && a.cost > left;
      b.innerHTML = '<span class="icon"></span><span class="name"></span><span class="cost"></span><small></small>';
      b.querySelector(".icon").textContent = a.icon;
      b.querySelector(".name").textContent = a.name;
      b.querySelector(".cost").textContent = a.cost + " P";
      b.querySelector("small").textContent = a.desc;
      b.onclick = function () {
        if (on) build.abilities = build.abilities.filter(function (x) { return x !== a.id; });
        else build.abilities.push(a.id);
        changed();
      };
      $("abilities").appendChild(b);
    });

    $("tactics").innerHTML = "";
    Game.TACTICS.forEach(function (t) {
      var b = document.createElement("button");
      b.className = "tactic" + (build.tactic === t.id ? " on" : "");
      b.innerHTML = '<span class="name"></span><small></small>';
      b.querySelector(".name").textContent = t.name;
      b.querySelector("small").textContent = t.desc;
      b.onclick = function () { build.tactic = t.id; changed(); };
      $("tactics").appendChild(b);
    });

    $("attempts").innerHTML = attempts.length ? "" : "<li class='none'>Noch kein Versuch.</li>";
    attempts.slice().reverse().forEach(function (a) {
      var li = document.createElement("li");
      li.className = a.won ? "won" : "lost";
      li.textContent = "#" + a.n + "  " + a.summary + "  →  " + (a.won ? "🏆 geschafft in Zug " + a.turn : "💀 Zug " + a.turn + (a.killer ? ", " + a.killer : ""));
      li.title = "Klicken, um diesen Build zu laden";
      li.onclick = function () { build = JSON.parse(JSON.stringify(a.build)); changed(); };
      $("attempts").appendChild(li);
    });
  }
  function changed() { save("pluto.build", build); renderSetup(); }

  function summary(b) {
    var t = Game.TACTICS.find(function (x) { return x.id === b.tactic; });
    var ab = b.abilities.map(function (id) { return Game.ABILITIES.find(function (a) { return a.id === id; }).icon; }).join("");
    return "L" + b.stats.hp + " A" + b.stats.atk + " R" + b.stats.def + " " + ab + " " + t.name;
  }

  // ---------- Abspielen ----------
  function play() {
    sim = Game.simulate(dungeon, build);
    var r = sim.result;
    attempts.push({ n: attempts.length + 1, build: JSON.parse(JSON.stringify(build)), summary: summary(build), won: r.won, turn: r.turn, killer: r.killer });
    save("pluto.attempts", attempts);
    idx = 0; playing = true; acc = 0;
    $("timeline").max = sim.frames.length - 1;
    $("setup").hidden = true;
    $("play").hidden = false;
    $("result").hidden = true;
    showFrame(0);
  }

  function showFrame(i) {
    idx = Math.max(0, Math.min(sim.frames.length - 1, i));
    frameSince = performance.now();
    var f = sim.frames[idx], h = f.hero;
    $("timeline").value = idx;
    $("turn").textContent = "Zug " + f.turn + " / " + sim.result.turn;
    $("hp").style.width = Math.max(0, 100 * h.hp / h.maxHp) + "%";
    $("hptext").textContent = h.hp + " / " + h.maxHp;
    $("herostats").innerHTML = "";
    [["Stufe", h.lvl], ["Angriff", h.atk], ["Rüstung", h.def], ["Tränke", h.potions], ["Gold", h.gold], ["Siege", h.kills]]
      .forEach(function (p) { var d = document.createElement("div"); d.innerHTML = "<span></span><b></b>"; d.firstChild.textContent = p[0]; d.lastChild.textContent = p[1]; $("herostats").appendChild(d); });
    // Logbuch: die letzten Ereignisse bis zu diesem Zug, neueste oben
    var lines = [];
    for (var k = idx; k >= 0 && lines.length < 14; k--) {
      var evs = sim.frames[k].events;
      for (var j = evs.length - 1; j >= 0 && lines.length < 14; j--) lines.push({ turn: sim.frames[k].turn, e: evs[j] });
    }
    $("log").innerHTML = "";
    lines.forEach(function (l, n) {
      var li = document.createElement("li");
      li.className = l.e.kind + (l.turn === f.turn ? " now" : "");
      li.textContent = l.turn + ": " + l.e.text;
      $("log").appendChild(li);
    });
    $("playpause").textContent = playing ? "⏸" : "▶";
    if (idx === sim.frames.length - 1) { playing = false; $("playpause").textContent = "▶"; showResult(); }
    else $("result").hidden = true;
  }

  function showResult() {
    var r = sim.result;
    $("result").hidden = false;
    $("result").className = r.won ? "won" : "lost";
    $("resulttitle").textContent = r.won ? "🏆 Dungeon geschafft!" : "💀 Gestorben";
    $("resulttext").textContent = r.won
      ? "In " + r.turn + " Zügen. Versuch es mit einem anderen Build noch schneller?"
      : r.timeout ? "Die Zeit ist abgelaufen (Zug " + r.turn + ")." : "In Zug " + r.turn + ", besiegt von: " + r.killer + ". Ändere deinen Build und versuch's nochmal.";
  }

  function tick(t) {
    var dt = Math.min(0.1, (t - lastT) / 1000); lastT = t;
    if (!$("play").hidden && sim) {
      if (playing) {
        acc += dt * speed;
        while (acc >= 1 && playing) { acc -= 1; showFrame(idx + 1); }
      }
      Game.render($("game").getContext("2d"), dungeon, sim, sim.frames[idx], frameSince);
    }
    requestAnimationFrame(tick);
  }

  function setSpeed(s) {
    speed = s;
    Array.prototype.forEach.call(document.querySelectorAll("#speeds button"), function (b) { b.classList.toggle("on", +b.dataset.s === s); });
  }

  function init() {
    dungeon = Game.generateDungeon(1);
    build = load("pluto.build", null);
    if (!build || Game.buildCost(build) > Game.BUDGET) build = Game.defaultBuild();
    attempts = load("pluto.attempts", []);
    $("budget").textContent = Game.BUDGET;

    $("start").onclick = play;
    $("reset").onclick = function () { build = Game.defaultBuild(); changed(); };
    $("clear").onclick = function () { attempts = []; save("pluto.attempts", attempts); renderSetup(); };
    $("back").onclick = $("change").onclick = function () { playing = false; $("play").hidden = true; $("setup").hidden = false; renderSetup(); };
    $("again").onclick = function () { playing = true; showFrame(0); };
    $("first").onclick = function () { playing = false; showFrame(0); };
    $("prev").onclick = function () { playing = false; showFrame(idx - 1); };
    $("next").onclick = function () { playing = false; showFrame(idx + 1); };
    $("last").onclick = function () { playing = false; showFrame(sim.frames.length - 1); };
    $("playpause").onclick = function () {
      if (idx === sim.frames.length - 1) showFrame(0);
      playing = !playing; acc = 0; $("playpause").textContent = playing ? "⏸" : "▶";
    };
    $("timeline").oninput = function () { playing = false; showFrame(+this.value); };
    $("speeds").innerHTML = "";
    SPEEDS.forEach(function (s) {
      var b = document.createElement("button");
      b.dataset.s = s; b.textContent = s + "×";
      b.onclick = function () { setSpeed(s); };
      $("speeds").appendChild(b);
    });
    setSpeed(speed);
    document.addEventListener("keydown", function (e) {
      if ($("play").hidden || !sim) return;
      if (e.key === " ") { e.preventDefault(); $("playpause").click(); }
      if (e.key === "ArrowRight") { e.preventDefault(); $("next").click(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); $("prev").click(); }
    });
    renderSetup();
    // Direkt-Einsprung, z. B. index.html#play=80 (startet den Lauf und springt zu Zug 80)
    var m = location.hash.match(/^#play(?:=(\d+))?$/);
    if (m) { play(); if (m[1]) { playing = false; showFrame(+m[1]); } }
    requestAnimationFrame(function (t) { lastT = t; tick(t); });
  }

  return { init: init };
})();
