// Auswahl-Bildschirm (Punkte verteilen) und Abspiel-Steuerung.
var Game = window.Game || (window.Game = {});

Game.ui = (function () {
  var $ = function (id) { return document.getElementById(id); };
  var build, seed = 1, dungeon, sim, idx = 0, playing = false, speed = 4, acc = 0, lastT = 0, frameSince = 0;
  var attempts = [];
  var SPEEDS = [2, 4, 8, 16, 60];

  function load(key, fallback) { try { var v = JSON.parse(localStorage.getItem(key)); return v || fallback; } catch (e) { return fallback; } }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }

  // ---------- Auswahl ----------
  function renderSetup() {
    var spent = Game.buildCost(build), left = Game.BUDGET - spent;
    var val = function (id) { var s = Game.STATS.find(function (x) { return x.id === id; }); return s.base + s.per * (build.stats[id] || 0); };

    // Heldenbogen
    $("v-hp").textContent = val("hp");
    $("v-atk").textContent = val("atk");
    $("v-def").textContent = val("def");
    var tac = Game.TACTICS.find(function (t) { return t.id === build.tactic; });
    var abs = build.abilities.map(function (id) { var a = Game.ABILITIES.find(function (x) { return x.id === id; }); return a.icon + " " + a.name; });
    $("chosen").textContent = tac.name + (abs.length ? ", " + abs.join(", ") : ", ohne Fähigkeiten");
    $("gems").innerHTML = "";
    for (var g = 0; g < Game.BUDGET; g++) { var i = document.createElement("i"); if (g < left) i.className = "full"; $("gems").appendChild(i); }
    $("points").textContent = left === 0 ? "Alle " + Game.BUDGET + " Punkte verteilt" : left === 1 ? "1 Punkt übrig" : left + " Punkte übrig";

    // Werte
    $("stats").innerHTML = "";
    Game.STATS.forEach(function (s) {
      var v = build.stats[s.id] || 0;
      var row = document.createElement("div");
      row.className = "stat";
      row.innerHTML = '<div class="stat-text"><b></b><small></small></div>' +
        '<div class="stepper"><button type="button" class="minus"></button><span class="count"></span><button type="button" class="plus"></button></div>';
      row.querySelector("b").textContent = s.name;
      row.querySelector("small").textContent = s.desc;
      row.querySelector(".count").textContent = v + " / " + s.max;
      var minus = row.querySelector(".minus"), plus = row.querySelector(".plus");
      minus.textContent = "−"; plus.textContent = "+";
      minus.setAttribute("aria-label", s.name + " verringern");
      plus.setAttribute("aria-label", s.name + " erhöhen");
      minus.disabled = v <= 0;
      plus.disabled = v >= s.max || left <= 0;
      minus.onclick = function () { build.stats[s.id]--; changed(); };
      plus.onclick = function () { build.stats[s.id] = v + 1; changed(); };
      $("stats").appendChild(row);
    });

    // Taktik
    $("tactics").innerHTML = "";
    Game.TACTICS.forEach(function (t) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", build.tactic === t.id);
      b.textContent = t.name;
      b.onclick = function () { build.tactic = t.id; changed(); };
      $("tactics").appendChild(b);
    });
    $("tactic-desc").textContent = tac.desc;

    // Fähigkeiten
    $("abilities").innerHTML = "";
    Game.ABILITIES.forEach(function (a) {
      var on = build.abilities.indexOf(a.id) >= 0;
      var row = document.createElement("label");
      row.className = "ability" + (on ? " on" : "");
      row.innerHTML = '<input type="checkbox"><span class="icon"></span><span class="ab-text"><b></b><small></small></span><span class="cost"></span>';
      var box = row.querySelector("input");
      box.checked = on;
      box.disabled = !on && a.cost > left;
      if (box.disabled) row.classList.add("locked");
      row.querySelector(".icon").textContent = a.icon;
      row.querySelector("b").textContent = a.name;
      row.querySelector("small").textContent = a.desc;
      var cost = row.querySelector(".cost");
      cost.textContent = a.cost;
      cost.appendChild(document.createElement("i"));
      cost.setAttribute("aria-label", a.cost === 1 ? "kostet 1 Punkt" : "kostet " + a.cost + " Punkte");
      box.onchange = function () {
        if (on) build.abilities = build.abilities.filter(function (x) { return x !== a.id; });
        else build.abilities.push(a.id);
        changed();
      };
      $("abilities").appendChild(row);
    });

    // Läufe
    $("seed").value = seed;
    $("attempts").innerHTML = attempts.length ? "" : "<li class='none'>Noch kein Lauf. Verteile deine Punkte und steig hinab.</li>";
    attempts.slice().reverse().forEach(function (a) {
      var li = document.createElement("li");
      li.className = a.won ? "won" : "lost";
      var btn = document.createElement("button");
      btn.type = "button";
      btn.innerHTML = '<span class="res"></span><span class="what"></span>';
      btn.querySelector(".res").textContent = a.won ? "Geschafft in Zug " + a.turn : "Gestorben in Zug " + a.turn + (a.killer ? " (" + a.killer + ")" : "");
      btn.querySelector(".what").textContent = "Dungeon " + (a.seed || 1) + ", " + a.summary;
      btn.title = "Diese Ausrüstung und diesen Dungeon laden";
      btn.onclick = function () { build = JSON.parse(JSON.stringify(a.build)); setSeed(a.seed || 1); changed(); };
      li.appendChild(btn);
      $("attempts").appendChild(li);
    });
  }
  function changed() { save("pluto.build", build); renderSetup(); }

  // ---------- Handbuch (aus den Spieldaten erzeugt) ----------
  function sprite(i) {
    return '<span class="sprite" style="background-position:-' + (i % 12) * 32 + 'px -' + Math.floor(i / 12) * 32 + 'px"></span>';
  }
  function esc(s) { var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }
  function renderHandbook() {
    var M = Game.MONSTERS, SP = Game.SPRITES, U = Game.UNREST, h = "";
    h += "<h3>Monster</h3><table><tr><th></th><th>Name</th><th>Leben</th><th>Angriff</th><th>Rüstung</th><th>EP</th><th></th></tr>";
    Object.keys(M).forEach(function (k) {
      var m = M[k];
      h += "<tr><td>" + sprite(SP[k]) + "</td><td><b>" + esc(m.name) + "</b></td><td>" + m.hp + "</td><td>" + m.atk + "</td><td>" + m.def +
        "</td><td>" + (m.xp || "–") + "</td><td class='d'>" + esc(m.desc || "") + "</td></tr>";
    });
    h += "</table><h3>Gegenstände</h3><table>";
    Object.keys(Game.ITEMS).forEach(function (k) {
      var it = Game.ITEMS[k];
      h += "<tr><td>" + sprite(SP[k]) + "</td><td><b>" + esc(it.name) + "</b></td><td class='d'>" + esc(it.desc || "") + "</td></tr>";
    });
    h += "</table><h3>Stufen</h3><p>Jeder Sieg bringt Erfahrungspunkte (EP). Für Stufe 2 braucht der Held " + Game.XP_PER_LEVEL +
      " EP, für jede weitere Stufe " + Game.XP_PER_LEVEL + " mehr (Stufe 3: " + 2 * Game.XP_PER_LEVEL + " EP, Stufe 4: " + 3 * Game.XP_PER_LEVEL +
      " EP …). Jeder Aufstieg: <b>+6 maximales Leben</b> (sofort geheilt) und <b>+1 Angriff</b>. Der Jäger bekommt +15 % EP.</p>";
    h += "<h3>Kampf</h3><ul><li>Jeder Zug: erst der Held, dann alle wachen Monster.</li>" +
      "<li>Der Held entscheidet in dieser Reihenfolge: Heiltrank trinken (wenn das Leben knapp ist) → Feuerball → zuschlagen (wenn ein Monster daneben steht) → weitergehen.</li>" +
      "<li>Schaden = Angriff ±1 − Rüstung des Getroffenen, mindestens 1. Deine Rüstung fängt höchstens 60 % eines Treffers ab.</li>" +
      "<li>Monster schlafen (z), bis du ihnen auf 5 Felder nahe kommst. Der Wächter wacht erst auf 3 Feldern auf.</li>" +
      "<li>Nach Zug " + Game.MAX_TURNS + " ist Schluss.</li></ul>";
    h += "<h3>Unruhe</h3><p>Wer trödelt, bekommt Besuch: Ab Zug " + U.start + " taucht alle " + U.every + " Züge irgendwo ein wacher Wanderer auf und sucht den Helden: " +
      U.types.map(function (t) { return esc(M[t].name); }).join(", ") + " … Rasten und Umwege kosten also mehr als nur Zeit.</p>";
    h += "<h3>Taktiken</h3><ul>" + Game.TACTICS.map(function (t) { return "<li><b>" + esc(t.name) + ":</b> " + esc(t.desc) + "</li>"; }).join("") + "</ul>";
    $("handbook-body").innerHTML = h;
  }
  function setSeed(s) {
    s = Math.max(1, Math.min(999999, Math.floor(+s) || 1));
    seed = s; save("pluto.seed", seed);
    var url = new URL(location.href); url.searchParams.set("seed", seed);
    history.replaceState(null, "", url.pathname + url.search + location.hash);
  }

  function summary(b) {
    var t = Game.TACTICS.find(function (x) { return x.id === b.tactic; });
    var ab = b.abilities.map(function (id) { return Game.ABILITIES.find(function (a) { return a.id === id; }).icon; }).join("");
    return "Leben " + b.stats.hp + ", Angriff " + b.stats.atk + ", Rüstung " + b.stats.def + ", " + t.name + (ab ? " " + ab : "");
  }

  // ---------- Abspielen ----------
  function play() {
    if (!dungeon || dungeon.seed !== seed) dungeon = Game.generateDungeon(seed);
    sim = Game.simulate(dungeon, build);
    var r = sim.result;
    $("dname").textContent = "Dungeon " + seed;
    attempts.push({ n: attempts.length + 1, seed: seed, build: JSON.parse(JSON.stringify(build)), summary: summary(build), won: r.won, turn: r.turn, killer: r.killer });
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
    $("resulttitle").textContent = r.won ? "Dungeon geschafft" : "Gestorben";
    $("resulttext").textContent = r.won
      ? "In " + r.turn + " Zügen. Schaffst du es mit anderer Ausrüstung schneller?"
      : r.timeout ? "Die Zeit ist abgelaufen (Zug " + r.turn + ")." : "In Zug " + r.turn + ", besiegt von: " + r.killer + ". Ändere die Ausrüstung und steig nochmal hinab.";
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
    var qs = new URLSearchParams(location.search).get("seed");
    setSeed(qs || load("pluto.seed", 1));
    build = load("pluto.build", null);
    if (!build || Game.buildCost(build) > Game.BUDGET) build = Game.defaultBuild();
    attempts = load("pluto.attempts", []);

    $("start").onclick = play;
    $("seed").onchange = function () { setSeed(this.value); renderSetup(); };
    $("dice").onclick = function () { setSeed(1 + Math.floor(Math.random() * 9999)); renderSetup(); };
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
    renderHandbook();
    if (location.hash === "#handbuch") { $("handbook").open = true; setTimeout(function () { $("handbook").scrollIntoView(); }, 50); }
    renderSetup();
    // Direkt-Einsprung, z. B. index.html#play=80 (startet den Lauf und springt zu Zug 80)
    var m = location.hash.match(/^#play(?:=(\d+))?$/);
    if (m) { play(); if (m[1]) { playing = false; showFrame(+m[1]); } }
    requestAnimationFrame(function (t) { lastT = t; tick(t); });
  }

  return { init: init };
})();
