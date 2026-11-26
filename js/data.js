// Spieldaten: Werte, Fähigkeiten, Taktiken, Monster. Alles hier ist zum Ausbalancieren da.
var Game = (typeof window !== "undefined" ? window : globalThis).Game || ((typeof window !== "undefined" ? window : globalThis).Game = {});

Game.BUDGET = 12;

// Grundwerte des Helden, jeder Punkt erhöht um "per"
Game.STATS = [
  { id: "hp", name: "Leben", base: 22, per: 6, max: 8, desc: "+6 maximale Lebenspunkte" },
  { id: "atk", name: "Angriff", base: 4, per: 1, max: 8, desc: "+1 Schaden pro Schlag" },
  { id: "def", name: "Rüstung", base: 0, per: 1, max: 6, desc: "−1 Schaden pro gegnerischem Treffer" },
];

// Fähigkeiten: einmal kaufen, wirken automatisch
Game.ABILITIES = [
  { id: "potions", name: "Heiltränke", cost: 2, icon: "🧪", desc: "Start mit 3 Tränken (heilen 50 %). Wird automatisch getrunken." },
  { id: "fireball", name: "Feuerball", cost: 3, icon: "🔥", desc: "Alle 5 Züge: 8 Schaden an einem Gegner bis 4 Felder entfernt, 4 an seinen Nachbarn." },
  { id: "vampire", name: "Vampirklinge", cost: 3, icon: "🩸", desc: "Heilt 30 % des verursachten Schadens." },
  { id: "thorns", name: "Dornenpanzer", cost: 2, icon: "🌵", desc: "Wer dich trifft, erleidet 3 Schaden." },
  { id: "dodge", name: "Ausweichen", cost: 2, icon: "💨", desc: "Jeder 4. gegnerische Angriff geht daneben." },
  { id: "berserk", name: "Berserker", cost: 2, icon: "😤", desc: "+50 % Schaden unter halber Lebensenergie." },
  { id: "regen", name: "Regeneration", cost: 2, icon: "💚", desc: "+1 Leben alle 3 Züge." },
  { id: "stealth", name: "Schleichen", cost: 1, icon: "🐾", desc: "Monster bemerken dich erst aus 2 statt 5 Feldern." },
];

// Taktik: wie der Held sich verhält (kostet nichts)
Game.TACTICS = [
  { id: "careful", name: "Vorsichtig", desc: "Weicht wachen Monstern aus, trinkt früh, will zum Ausgang." },
  { id: "balanced", name: "Ausgewogen", desc: "Sammelt nahe Schätze ein, kämpft, wenn's sein muss." },
  { id: "hunter", name: "Jäger", desc: "Jagt jedes Monster, das er sieht. Mehr Erfahrung, mehr Risiko." },
];

Game.MONSTERS = {
  rat: { name: "Ratte", letter: "r", color: "#b39b7a", hp: 7, atk: 3, def: 0, xp: 1 },
  goblin: { name: "Goblin", letter: "g", color: "#6fbf5b", hp: 14, atk: 5, def: 0, xp: 2 },
  skeleton: { name: "Skelett", letter: "s", color: "#d8d8c8", hp: 20, atk: 6, def: 1, xp: 3 },
  orc: { name: "Ork", letter: "o", color: "#4f8a3c", hp: 32, atk: 8, def: 2, xp: 5 },
  boss: { name: "Höhlenwächter", letter: "W", color: "#c0392b", hp: 90, atk: 11, def: 3, xp: 0, boss: true },
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
