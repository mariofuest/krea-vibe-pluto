// Spieldaten: Werte, Fähigkeiten, Taktiken, Monster. Alles hier ist zum Ausbalancieren da.
var Game = (typeof window !== "undefined" ? window : globalThis).Game || ((typeof window !== "undefined" ? window : globalThis).Game = {});

Game.BUDGET = 12;

// Grundwerte des Helden, jeder Punkt erhöht um "per"
Game.STATS = [
  { id: "hp", name: "Leben", base: 14, per: 8, max: 8, desc: "+8 maximale Lebenspunkte" },
  { id: "atk", name: "Angriff", base: 4, per: 1, max: 8, desc: "+1 Schaden pro Schlag" },
  { id: "def", name: "Rüstung", base: 0, per: 1, max: 6, desc: "−1 Schaden pro gegnerischem Treffer (höchstens −60 %)" },
];

// Fähigkeiten: einmal kaufen, wirken automatisch
Game.ABILITIES = [
  { id: "potions", name: "Heiltränke", cost: 2, icon: "🧪", desc: "Start mit 3 Tränken (heilen 40 %). Wird automatisch getrunken." },
  { id: "fireball", name: "Feuerball", cost: 3, icon: "🔥", desc: "Alle 5 Züge: 12 Schaden an einem Gegner bis 5 Felder entfernt, 5 an seinen Nachbarn. Ignoriert Rüstung." },
  { id: "vampire", name: "Vampirklinge", cost: 3, icon: "🩸", desc: "Heilt 25 % des verursachten Schadens." },
  { id: "thorns", name: "Dornenpanzer", cost: 2, icon: "🌵", desc: "Wer dich trifft, erleidet 3 Schaden." },
  { id: "dodge", name: "Ausweichen", cost: 2, icon: "💨", desc: "Jeder 4. gegnerische Angriff geht daneben." },
  { id: "berserk", name: "Berserker", cost: 2, icon: "😤", desc: "+75 % Schaden unter halber Lebensenergie." },
  { id: "regen", name: "Regeneration", cost: 2, icon: "💚", desc: "+1 Leben alle 2 Züge." },
  { id: "crit", name: "Kritische Treffer", cost: 2, icon: "🎯", desc: "Jeder 3. Schlag richtet 2,5-fachen Schaden an." },
  { id: "poison", name: "Giftklinge", cost: 2, icon: "🐍", desc: "Getroffene Monster verlieren 3 Züge lang je 3 Leben (ignoriert Rüstung)." },
  { id: "frenzy", name: "Siegesrausch", cost: 2, icon: "🍖", desc: "Jeder Sieg heilt bis zu 6 Leben." },
  { id: "swift", name: "Flink", cost: 2, icon: "👟", desc: "Jeder 3. Zug zählt doppelt: zwei Aktionen statt einer." },
  { id: "torch", name: "Fackel", cost: 1, icon: "🕯️", desc: "Leuchtet 9 statt 6 Felder weit und brennt: +1 Schaden pro Schlag, ignoriert Rüstung. Geister und Ratten fürchten das Licht (halber Schaden)." },
  { id: "phoenix", name: "Phönixfeder", cost: 2, icon: "🪶", desc: "Einmal pro Lauf: Statt zu sterben, mit halber Lebensenergie weitermachen." },
  { id: "stealth", name: "Schleichen", cost: 1, icon: "🐾", desc: "Schlafende Monster wachen nicht auf, wenn du vorbeischleichst. Hinterhalt: Der erste Schlag gegen einen Schläfer richtet dreifachen Schaden an. Die Unruhe setzt 60 Züge später ein." },
];

// Taktik: wie der Held sich verhält (kostet nichts)
Game.TACTICS = [
  { id: "careful", name: "Vorsichtig", desc: "Weicht wachen Monstern aus, trinkt früh und rastet sich gesund (+3 Leben pro Zug), wenn die Luft rein ist. Langsam: die Unruhe holt ihn eher ein." },
  { id: "balanced", name: "Ausgewogen", desc: "Sammelt nahe Schätze ein und kämpft, wenn's sein muss. Findet in jeder 3. Truhe zusätzlich einen Heiltrank." },
  { id: "hunter", name: "Jäger", desc: "Jagt jedes Monster, das er sieht, und bekommt dafür +15 % Erfahrung. Steigt schneller auf, lebt gefährlicher." },
];

Game.MONSTERS = {
  rat: { name: "Ratte", letter: "r", color: "#b39b7a", hp: 7, atk: 3, def: 0, xp: 1, threat: 1, desc: "Schwach, aber oft in Gruppen. Fürchtet Licht." },
  goblin: { name: "Goblin", letter: "g", color: "#6fbf5b", hp: 14, atk: 5, def: 0, xp: 2, threat: 2, desc: "Angriffslustiger Plagegeist der oberen Räume." },
  skeleton: { name: "Geist", letter: "s", color: "#d8d8c8", hp: 20, atk: 6, def: 1, xp: 3, threat: 3, desc: "Zäh und schwer zu treffen (1 Rüstung). Fürchtet Licht." },
  orc: { name: "Ork", letter: "o", color: "#4f8a3c", hp: 32, atk: 8, def: 2, xp: 5, threat: 5, desc: "Gefährlicher Schläger in den tiefen Räumen." },
  boss: { name: "Höhlenwächter", letter: "W", color: "#c0392b", hp: 95, atk: 11, def: 3, xp: 0, boss: true, desc: "Bewacht den Ausgang und verlässt seinen Posten nie. Erst wenn er fällt, öffnet sich die Tür." },
};

Game.ITEMS = {
  potion: { name: "Heiltrank", color: "#e74c6f", desc: "+1 Trank. Wird automatisch getrunken, wenn das Leben knapp wird (heilt 40 %)." },
  gold: { name: "Truhe", color: "#f1c40f", desc: "5–15 Gold. Bei der Taktik „Ausgewogen“ liegt in jeder 3. Truhe auch ein Trank." },
  sword: { name: "Schwert", color: "#9ecbff", desc: "+2 Angriff. Liegt in der Mitte des Dungeons." },
  armor: { name: "Schild", color: "#a0a0b8", desc: "+1 Rüstung. Liegt in der Mitte des Dungeons." },
};

// Unruhe: Ab Zug "start" taucht alle "every" Züge ein wacher Wanderer auf, mit der Zeit gefährlichere.
Game.UNREST = { start: 90, every: 35, types: ["goblin", "skeleton", "orc", "orc", "orc"] };

Game.XP_PER_LEVEL = 6; // Stufenaufstieg: +6 max. Leben (und volle 6 geheilt), +1 Angriff

Game.defaultBuild = function () {
  return { stats: { hp: 5, atk: 4, def: 1 }, abilities: ["potions"], tactic: "balanced" };
};

Game.buildCost = function (b) {
  var cost = 0;
  Game.STATS.forEach(function (s) { cost += b.stats[s.id] || 0; });
  b.abilities.forEach(function (id) {
    var a = Game.ABILITIES.find(function (x) { return x.id === id; });
    if (a) cost += a.cost;
  });
  return cost;
};
