// Minimal starting point: a square you can move with the arrow keys.
// Replace freely. Split features into separate files under js/ as the game grows.

var Game = window.Game || (window.Game = {});

(function () {
  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");

  var keys = {};
  window.addEventListener("keydown", function (e) {
    keys[e.key] = true;
    if (e.key.indexOf("Arrow") === 0 || e.key === " ") e.preventDefault();
  });
  window.addEventListener("keyup", function (e) { keys[e.key] = false; });

  var player = { x: 380, y: 280, size: 40, speed: 240 };

  function update(dt) {
    if (keys.ArrowLeft) player.x -= player.speed * dt;
    if (keys.ArrowRight) player.x += player.speed * dt;
    if (keys.ArrowUp) player.y -= player.speed * dt;
    if (keys.ArrowDown) player.y += player.speed * dt;
    player.x = Math.max(0, Math.min(canvas.width - player.size, player.x));
    player.y = Math.max(0, Math.min(canvas.height - player.size, player.y));
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#6c8cff";
    ctx.fillRect(player.x, player.y, player.size, player.size);
    ctx.fillStyle = "#888";
    ctx.font = "20px system-ui, sans-serif";
    ctx.fillText("Your game starts here", 20, 36);
  }

  var last = performance.now();
  function loop(now) {
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
