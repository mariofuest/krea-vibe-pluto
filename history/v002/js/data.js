// Spieldaten: Werte, Fähigkeiten, Taktiken, Monster. Alles hier ist zum Ausbalancieren da.
var Game = (typeof window !== "undefined" ? window : globalThis).Game || ((typeof window !== "undefined" ? window : globalThis).Game = {});

Game.BUDGET = 12;

// Grundwerte des Helden, jeder Punkt erhöht um "per"
Game.STATS = [
  { id: "hp", name: "Leben", base: 22, per: 8, max: 8, desc: "+8 maximale Lebenspunkte" },
  { id: "atk", name: "Angriff", base: 4, per: 1, max: 8, desc: "+1 Schaden pro Schlag" },
  { id: "def", name: "Rüstung", base: 0, per: 1, max: 6, desc: "−1 Schaden pro gegnerischem Treffer (höchstens −60 %)" },
];

// Fähigkeiten: einmal kaufen, wirken automatisch
Game.ABILITIES = [
  { id: "potions", name: "Heiltränke", cost: 2, icon: "🧪", desc: "Start mit 2 Tränken (heilen 40 %). Wird automatisch getrunken." },
  { id: "fireball", name: "Feuerball", cost: 3, icon: "🔥", desc: "Alle 5 Züge: 10 Schaden an einem Gegner bis 5 Felder entfernt, 5 an seinen Nachbarn. Ignoriert Rüstung." },
  { id: "vampire", name: "Vampirklinge", cost: 3, icon: "🩸", desc: "Heilt 30 % des verursachten Schadens." },
  { id: "thorns", name: "Dornenpanzer", cost: 2, icon: "🌵", desc: "Wer dich trifft, erleidet 3 Schaden." },
  { id: "dodge", name: "Ausweichen", cost: 2, icon: "💨", desc: "Jeder 4. gegnerische Angriff geht daneben." },
  { id: "berserk", name: "Berserker", cost: 2, icon: "😤", desc: "+50 % Schaden unter halber Lebensenergie." },
  { id: "regen", name: "Regeneration", cost: 2, icon: "💚", desc: "+1 Leben alle 3 Züge." },
  { id: "stealth", name: "Schleichen", cost: 1, icon: "🐾", desc: "Monster bemerken dich erst aus 2 statt 5 Feldern. Hinterhalt: Schläge gegen schlafende Monster richten dreifachen Schaden an." },
];

// Taktik: wie der Held sich verhält (kostet nichts)
Game.TACTICS = [
  { id: "careful", name: "Vorsichtig", desc: "Weicht wachen Monstern aus, trinkt früh und rastet sich gesund, wenn die Luft rein ist (+2 Leben pro Zug)." },
  { id: "balanced", name: "Ausgewogen", desc: "Sammelt nahe Schätze ein, kämpft, wenn's sein muss." },
  { id: "hunter", name: "Jäger", desc: "Jagt jedes Monster, das er sieht. Mehr Erfahrung, mehr Risiko." },
];

Game.MONSTERS = {
  rat: { name: "Ratte", letter: "r", color: "#b39b7a", hp: 7, atk: 3, def: 0, xp: 1, threat: 1 },
  goblin: { name: "Goblin", letter: "g", color: "#6fbf5b", hp: 14, atk: 5, def: 0, xp: 2, threat: 2 },
  skeleton: { name: "Geist", letter: "s", color: "#d8d8c8", hp: 20, atk: 6, def: 1, xp: 3, threat: 3 },
  orc: { name: "Ork", letter: "o", color: "#4f8a3c", hp: 32, atk: 8, def: 2, xp: 5, threat: 5 },
  boss: { name: "Höhlenwächter", letter: "W", color: "#c0392b", hp: 72, atk: 10, def: 3, xp: 0, boss: true },
};

Game.ITEMS = {
  potion: { name: "Heiltrank", color: "#e74c6f" },
  gold: { name: "Gold", color: "#f1c40f" },
  sword: { name: "Schwert", color: "#9ecbff", desc: "+2 Angriff" },
  armor: { name: "Rüstungsteil", color: "#a0a0b8", desc: "+1 Rüstung" },
};

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
