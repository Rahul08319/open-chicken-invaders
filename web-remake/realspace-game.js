(function () {
  "use strict";

  const W = 720;
  const H = 1280;

  document.body.innerHTML = `
    <div class="realspace-page">
      <main class="realspace-shell">
        <section class="realspace-hud" aria-label="Game status">
          <div><span>Score</span><strong id="score-value">0</strong></div>
          <div><span>Lives</span><strong id="lives-value">3</strong></div>
          <div><span>Wave</span><strong id="wave-value">1</strong></div>
          <div><span>Gun</span><strong id="gun-value">1</strong></div>
          <div><span>Mx</span><strong id="multiplier-value">1</strong></div>
        </section>
        <section class="realspace-arena">
          <canvas id="game-canvas" width="${W}" height="${H}" aria-label="Chicken Invaders Realspace Assault"></canvas>
          <div id="toast" class="realspace-toast"></div>
          <div id="start-overlay" class="realspace-overlay visible">
            <div class="realspace-panel">
              <p>Photoreal arcade remake</p>
              <h1>Chicken Invaders: Realspace Assault</h1>
              <button id="start-btn" type="button">Launch Sortie</button>
            </div>
          </div>
          <div id="gameover-overlay" class="realspace-overlay">
            <div class="realspace-panel">
              <p>Mission report</p>
              <h2>Run Complete</h2>
              <strong id="gameover-message">Score 0</strong>
              <button id="play-again-btn" type="button">Fly Again</button>
            </div>
          </div>
          <div class="realspace-controls">
            <button id="restart-btn" type="button">Restart</button>
            <button id="bomb-btn" type="button">EMP <strong id="bomb-stock">2</strong></button>
          </div>
        </section>
      </main>
    </div>
  `;

  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  const els = {
    score: document.getElementById("score-value"),
    lives: document.getElementById("lives-value"),
    wave: document.getElementById("wave-value"),
    gun: document.getElementById("gun-value"),
    mult: document.getElementById("multiplier-value"),
    bombs: document.getElementById("bomb-stock"),
    start: document.getElementById("start-overlay"),
    gameover: document.getElementById("gameover-overlay"),
    message: document.getElementById("gameover-message"),
    toast: document.getElementById("toast"),
  };

  const pointer = { x: W / 2, y: H - 170, active: false };
  const input = { left: false, right: false, up: false, down: false };
  const state = {
    mode: "menu",
    time: 0,
    score: 0,
    best: Number(localStorage.getItem("realspace-best") || 0),
    lives: 3,
    wave: 1,
    gun: 1,
    mult: 1,
    bombs: 2,
    fireTimer: 0,
    player: { x: W / 2, y: H - 160, r: 46, invulnerable: 0, shield: 0 },
    enemies: [],
    shots: [],
    eggs: [],
    particles: [],
    pickups: [],
    stars: Array.from({ length: 120 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      z: 0.3 + Math.random() * 1.4,
    })),
  };

  function reset() {
    Object.assign(state, {
      mode: "playing",
      time: 0,
      score: 0,
      lives: 3,
      wave: 1,
      gun: 1,
      mult: 1,
      bombs: 2,
      fireTimer: 0,
      enemies: [],
      shots: [],
      eggs: [],
      particles: [],
      pickups: [],
    });
    state.player.x = W / 2;
    state.player.y = H - 160;
    state.player.invulnerable = 1.3;
    state.player.shield = 0;
    spawnWave();
    hide(els.start);
    hide(els.gameover);
    toast("Wave 1");
    updateHud();
  }

  function spawnWave() {
    state.enemies = [];
    const bossWave = state.wave % 4 === 0;
    if (bossWave) {
      state.enemies.push({ type: "boss", x: W / 2, y: 170, baseX: W / 2, r: 96, hp: 18 + state.wave * 3, maxHp: 18 + state.wave * 3, egg: 1.2 });
      toast("Boss incoming");
      return;
    }
    const rows = Math.min(4, 2 + Math.floor(state.wave / 2));
    const cols = Math.min(7, 4 + state.wave);
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        state.enemies.push({
          type: "hen",
          x: 95 + col * ((W - 190) / Math.max(1, cols - 1)),
          y: 125 + row * 95,
          baseX: 95 + col * ((W - 190) / Math.max(1, cols - 1)),
          r: 38,
          hp: 2 + Math.floor(state.wave / 3),
          maxHp: 2 + Math.floor(state.wave / 3),
          egg: 1.3 + Math.random() * 2.2,
        });
      }
    }
    toast(`Wave ${state.wave}`);
  }

  function update(dt) {
    if (state.mode !== "playing") return;
    state.time += dt;
    movePlayer(dt);
    shoot(dt);
    updateEnemies(dt);
    updateShots(dt);
    updateEggs(dt);
    updatePickups(dt);
    updateParticles(dt);
    if (!state.enemies.length) {
      state.wave += 1;
      state.mult = Math.min(9, state.mult + 1);
      state.bombs = Math.min(5, state.bombs + (state.wave % 3 === 0 ? 1 : 0));
      spawnWave();
    }
    updateHud();
  }

  function movePlayer(dt) {
    const speed = 470;
    let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (pointer.active) {
      state.player.x += (pointer.x - state.player.x) * Math.min(1, dt * 10);
      state.player.y += (pointer.y - state.player.y) * Math.min(1, dt * 10);
    } else if (dx || dy) {
      const len = Math.hypot(dx, dy) || 1;
      state.player.x += (dx / len) * speed * dt;
      state.player.y += (dy / len) * speed * dt;
    }
    state.player.x = clamp(state.player.x, 65, W - 65);
    state.player.y = clamp(state.player.y, H * 0.55, H - 95);
    state.player.invulnerable = Math.max(0, state.player.invulnerable - dt);
    state.player.shield = Math.max(0, state.player.shield - dt);
  }

  function shoot(dt) {
    state.fireTimer -= dt;
    if (state.fireTimer > 0) return;
    state.fireTimer = Math.max(0.1, 0.25 - state.gun * 0.025);
    const lanes = Math.min(5, state.gun);
    for (let i = 0; i < lanes; i += 1) {
      const offset = (i - (lanes - 1) / 2) * 18;
      state.shots.push({ x: state.player.x + offset, y: state.player.y - 58, vy: -920, r: 5, damage: 1 });
    }
  }

  function updateEnemies(dt) {
    for (const e of state.enemies) {
      const amp = e.type === "boss" ? 180 : 35 + state.wave * 4;
      e.x = e.baseX + Math.sin(state.time * (e.type === "boss" ? 0.9 : 1.7) + e.y * 0.02) * amp;
      e.y += (e.type === "boss" ? 8 : 12 + state.wave * 1.5) * dt;
      e.egg -= dt;
      if (e.egg <= 0) {
        e.egg = (e.type === "boss" ? 0.55 : 1.3 + Math.random() * 2.3) / (1 + state.wave * 0.05);
        state.eggs.push({ x: e.x + rand(-18, 18), y: e.y + 35, vy: e.type === "boss" ? 360 : 270 + state.wave * 12, r: e.type === "boss" ? 18 : 14 });
      }
    }
  }

  function updateShots(dt) {
    for (const s of state.shots) s.y += s.vy * dt;
    for (let si = state.shots.length - 1; si >= 0; si -= 1) {
      const s = state.shots[si];
      if (s.y < -20) {
        state.shots.splice(si, 1);
        continue;
      }
      const hit = state.enemies.find((e) => dist(s, e) < s.r + e.r);
      if (!hit) continue;
      hit.hp -= s.damage;
      burst(s.x, s.y, "#8df4ff", 5);
      state.shots.splice(si, 1);
      if (hit.hp <= 0) killEnemy(hit);
    }
  }

  function killEnemy(enemy) {
    state.enemies = state.enemies.filter((e) => e !== enemy);
    state.score += (enemy.type === "boss" ? 1500 : 100) * state.mult;
    burst(enemy.x, enemy.y, enemy.type === "boss" ? "#ffc36f" : "#e7a36a", enemy.type === "boss" ? 34 : 14);
    if (Math.random() < (enemy.type === "boss" ? 1 : 0.2)) {
      const types = ["weapon", "shield", "bomb"];
      state.pickups.push({ type: types[Math.floor(Math.random() * types.length)], x: enemy.x, y: enemy.y, vy: 150, r: 24, spin: 0 });
    }
  }

  function updateEggs(dt) {
    for (const egg of state.eggs) egg.y += egg.vy * dt;
    state.eggs = state.eggs.filter((egg) => egg.y < H + 40);
    if (state.player.invulnerable > 0) return;
    for (const egg of state.eggs) {
      if (dist(egg, state.player) < egg.r + state.player.r * 0.65) {
        if (state.player.shield > 0) {
          state.player.shield = 0;
          burst(state.player.x, state.player.y, "#80efff", 22);
        } else {
          loseLife();
        }
        egg.y = H + 100;
        break;
      }
    }
  }

  function updatePickups(dt) {
    for (const p of state.pickups) {
      p.y += p.vy * dt;
      p.spin += dt * 3;
      if (dist(p, state.player) < p.r + state.player.r) {
        collect(p);
        p.y = H + 100;
      }
    }
    state.pickups = state.pickups.filter((p) => p.y < H + 50);
  }

  function collect(pickup) {
    if (pickup.type === "weapon") state.gun = Math.min(5, state.gun + 1);
    if (pickup.type === "shield") state.player.shield = 7;
    if (pickup.type === "bomb") state.bombs = Math.min(5, state.bombs + 1);
    state.score += 250;
    toast(`${pickup.type.toUpperCase()} secured`);
    burst(pickup.x, pickup.y, pickup.type === "bomb" ? "#ffbe70" : "#80efff", 20);
  }

  function loseLife() {
    state.lives -= 1;
    state.mult = 1;
    state.player.invulnerable = 1.8;
    burst(state.player.x, state.player.y, "#ffb072", 34);
    if (state.lives <= 0) {
      state.mode = "over";
      state.best = Math.max(state.best, state.score);
      localStorage.setItem("realspace-best", String(state.best));
      els.message.textContent = `Score ${state.score.toLocaleString()} | Best ${state.best.toLocaleString()}`;
      show(els.gameover);
      window.ytgame?.engagement?.sendScore?.(state.score);
    }
  }

  function useBomb() {
    if (state.mode !== "playing" || state.bombs <= 0) return;
    state.bombs -= 1;
    for (const e of [...state.enemies]) killEnemy(e);
    state.eggs = [];
    burst(W / 2, H / 2, "#d6f7ff", 70);
    toast("EMP detonated");
    updateHud();
  }

  function burst(x, y, color, count) {
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = rand(90, 380);
      state.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.25, 0.8), color });
    }
  }

  function updateParticles(dt) {
    for (const p of state.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= dt;
    }
    state.particles = state.particles.filter((p) => p.life > 0);
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    drawShots();
    drawEnemies();
    drawEggs();
    drawPickups();
    drawPlayer();
    drawParticles();
  }

  function drawBackground() {
    const deepSpace = ctx.createLinearGradient(0, 0, 0, H);
    deepSpace.addColorStop(0, "#030712");
    deepSpace.addColorStop(0.5, "#06111f");
    deepSpace.addColorStop(1, "#020306");
    ctx.fillStyle = deepSpace;
    ctx.fillRect(0, 0, W, H);

    const sun = ctx.createRadialGradient(W * 0.86, H * 0.12, 0, W * 0.86, H * 0.12, W * 0.55);
    sun.addColorStop(0, "rgba(255, 204, 134, 0.5)");
    sun.addColorStop(0.18, "rgba(247, 143, 82, 0.18)");
    sun.addColorStop(1, "rgba(247, 143, 82, 0)");
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, W, H);

    const planet = ctx.createRadialGradient(W * 0.1, H * 0.98, 30, W * 0.1, H * 0.98, W * 0.82);
    planet.addColorStop(0, "rgba(151, 207, 255, 0.42)");
    planet.addColorStop(0.52, "rgba(24, 79, 128, 0.26)");
    planet.addColorStop(0.68, "rgba(65, 154, 232, 0.18)");
    planet.addColorStop(0.7, "rgba(128, 214, 255, 0.36)");
    planet.addColorStop(0.73, "rgba(128, 214, 255, 0)");
    ctx.fillStyle = planet;
    ctx.beginPath();
    ctx.arc(W * 0.1, H * 0.98, W * 0.82, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(164, 221, 255, 0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W * 0.1, H * 0.98, W * 0.58, Math.PI * 1.08, Math.PI * 1.9);
    ctx.stroke();

    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    for (const s of state.stars) {
      s.y += s.z * 0.18;
      if (s.y > H) s.y = 0;
      ctx.globalAlpha = 0.18 + s.z * 0.3;
      ctx.fillRect(s.x, s.y, s.z, s.z);
    }
    ctx.restore();
  }

  function drawPlayer() {
    const p = state.player;
    ctx.save();
    if (p.invulnerable > 0 && Math.floor(state.time * 16) % 2 === 0) ctx.globalAlpha = 0.55;
    drawGlow(p.x, p.y + 55, 62, "rgba(255,154,90,0.28)");
    drawRealisticShip(p.x, p.y, state.time);
    if (p.shield > 0) {
      ctx.strokeStyle = "rgba(126, 237, 255, 0.9)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 72, 92, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawEnemies() {
    for (const e of state.enemies) {
      ctx.save();
      if (e.type === "boss") {
        drawBossDrone(e.x, e.y, e.hp / e.maxHp);
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(e.x - 70, e.y - 95, 140, 8);
        ctx.fillStyle = "#f7c06d";
        ctx.fillRect(e.x - 70, e.y - 95, 140 * (e.hp / e.maxHp), 8);
      } else {
        drawCombatDrone(e.x, e.y, 1, state.time + e.baseX * 0.01);
      }
      ctx.restore();
    }
  }

  function drawEggs() {
    for (const egg of state.eggs) {
      drawPlasmaPod(egg.x, egg.y, egg.r);
    }
  }

  function drawShots() {
    for (const s of state.shots) {
      const g = ctx.createLinearGradient(s.x, s.y + 22, s.x, s.y - 22);
      g.addColorStop(0, "rgba(124,237,255,0)");
      g.addColorStop(0.45, "#7cf1ff");
      g.addColorStop(1, "#ffffff");
      ctx.strokeStyle = g;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y + 20);
      ctx.lineTo(s.x, s.y - 22);
      ctx.stroke();
    }
  }

  function drawPickups() {
    for (const p of state.pickups) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.sin(p.spin) * 0.12);
      drawGlow(0, 0, 38, p.type === "bomb" ? "rgba(255,179,94,0.36)" : "rgba(111,230,255,0.34)");
      if (p.type === "weapon") drawMetalModule(0, 0, "#7eefff");
      if (p.type === "shield") drawShieldCell(0, 0);
      if (p.type === "bomb") drawBombCanister(0, 0);
      ctx.restore();
    }
  }

  function drawMetalModule(x, y, color) {
    const g = ctx.createLinearGradient(x - 28, y - 16, x + 28, y + 18);
    g.addColorStop(0, "#d9dde1");
    g.addColorStop(0.45, "#4d555f");
    g.addColorStop(1, "#10141a");
    roundRect(x - 34, y - 20, 68, 40, 8, g);
    ctx.fillStyle = color;
    roundRect(x - 20, y - 6, 40, 12, 6, color);
  }

  function drawShieldCell(x, y) {
    const g = ctx.createLinearGradient(x - 22, y - 34, x + 22, y + 34);
    g.addColorStop(0, "#252b32");
    g.addColorStop(0.5, "#77f2ff");
    g.addColorStop(1, "#090c10");
    roundRect(x - 20, y - 34, 40, 68, 12, g);
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.strokeRect(x - 14, y - 22, 28, 44);
  }

  function drawBombCanister(x, y) {
    const g = ctx.createLinearGradient(x - 22, y - 34, x + 24, y + 34);
    g.addColorStop(0, "#4c4e52");
    g.addColorStop(0.48, "#0b0c0e");
    g.addColorStop(1, "#24272b");
    roundRect(x - 22, y - 35, 44, 70, 10, g);
    ctx.fillStyle = "#f3a84f";
    roundRect(x - 13, y - 6, 26, 13, 4, "#f3a84f");
  }

  function drawParticles() {
    ctx.save();
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3 + p.life * 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawRealisticShip(x, y, phase) {
    ctx.save();
    ctx.translate(x, y + Math.sin(phase * 4) * 1.5);
    for (const side of [-1, 1]) {
      const flame = ctx.createLinearGradient(side * 30, 42, side * 30, 108);
      flame.addColorStop(0, "rgba(238,252,255,0.96)");
      flame.addColorStop(0.28, "rgba(73,205,255,0.88)");
      flame.addColorStop(0.7, "rgba(255,124,49,0.45)");
      flame.addColorStop(1, "rgba(255,79,25,0)");
      ctx.fillStyle = flame;
      ctx.beginPath();
      ctx.moveTo(side * 22, 44);
      ctx.bezierCurveTo(side * 18, 69, side * 24, 95, side * 31, 108);
      ctx.bezierCurveTo(side * 39, 92, side * 43, 68, side * 40, 44);
      ctx.closePath();
      ctx.fill();
    }

    const wings = ctx.createLinearGradient(-90, -24, 90, 62);
    wings.addColorStop(0, "#cbd3d8");
    wings.addColorStop(0.2, "#4d5963");
    wings.addColorStop(0.48, "#111922");
    wings.addColorStop(0.76, "#69747b");
    wings.addColorStop(1, "#0a1016");
    ctx.fillStyle = wings;
    ctx.beginPath();
    ctx.moveTo(-12, -42);
    ctx.lineTo(-91, 36);
    ctx.lineTo(-81, 67);
    ctx.lineTo(-31, 43);
    ctx.lineTo(-17, 71);
    ctx.lineTo(0, 43);
    ctx.lineTo(17, 71);
    ctx.lineTo(31, 43);
    ctx.lineTo(81, 67);
    ctx.lineTo(91, 36);
    ctx.lineTo(12, -42);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(229,241,247,0.42)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-14, -22);
    ctx.lineTo(-71, 38);
    ctx.lineTo(-31, 28);
    ctx.moveTo(14, -22);
    ctx.lineTo(71, 38);
    ctx.lineTo(31, 28);
    ctx.stroke();

    const hull = ctx.createLinearGradient(-30, -86, 32, 72);
    hull.addColorStop(0, "#f5f7f6");
    hull.addColorStop(0.16, "#89949a");
    hull.addColorStop(0.46, "#1a2631");
    hull.addColorStop(0.74, "#707d86");
    hull.addColorStop(1, "#111821");
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.moveTo(0, -93);
    ctx.bezierCurveTo(26, -59, 32, -16, 35, 18);
    ctx.lineTo(25, 65);
    ctx.lineTo(0, 50);
    ctx.lineTo(-25, 65);
    ctx.lineTo(-35, 18);
    ctx.bezierCurveTo(-32, -16, -26, -59, 0, -93);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(240,248,251,0.5)";
    ctx.stroke();

    const canopy = ctx.createLinearGradient(-18, -60, 20, -4);
    canopy.addColorStop(0, "#dcfbff");
    canopy.addColorStop(0.22, "#54b8ce");
    canopy.addColorStop(0.62, "#102e43");
    canopy.addColorStop(1, "#030a10");
    ctx.fillStyle = canopy;
    ctx.beginPath();
    ctx.ellipse(0, -34, 18, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(182,242,255,0.7)";
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.66)";
    ctx.beginPath();
    ctx.ellipse(-6, -46, 4, 10, -0.35, 0, Math.PI * 2);
    ctx.fill();

    for (const side of [-1, 1]) {
      const metal = ctx.createLinearGradient(side * 70, 0, side * 50, 68);
      metal.addColorStop(0, "#cfd8dc");
      metal.addColorStop(0.4, "#343e47");
      metal.addColorStop(1, "#080d12");
      roundRect(side * 58 - 6, 8, 12, 61, 4, metal);
      roundRect(side * 58 - 4, -4, 8, 23, 3, "#8bddec");
      const engine = ctx.createRadialGradient(side * 31, 51, 1, side * 31, 51, 14);
      engine.addColorStop(0, "#d3fbff");
      engine.addColorStop(0.35, "#327a92");
      engine.addColorStop(1, "#070b0e");
      ctx.fillStyle = engine;
      ctx.beginPath();
      ctx.ellipse(side * 31, 51, 14, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#f3ad58";
    ctx.fillRect(-2, 18, 4, 21);
    ctx.restore();
  }

  function drawCombatDrone(x, y, scale, phase) {
    ctx.save();
    ctx.translate(x, y + Math.sin(phase * 4) * 2);
    ctx.scale(scale, scale);
    drawGlow(0, 12, 62, "rgba(49, 198, 242, 0.17)");
    const wing = ctx.createLinearGradient(-80, -28, 80, 30);
    wing.addColorStop(0, "#10171d");
    wing.addColorStop(0.22, "#788188");
    wing.addColorStop(0.48, "#222a30");
    wing.addColorStop(0.76, "#98704b");
    wing.addColorStop(1, "#0b1014");
    ctx.fillStyle = wing;
    ctx.beginPath();
    ctx.moveTo(-16, -13);
    ctx.lineTo(-80, -29);
    ctx.lineTo(-69, 8);
    ctx.lineTo(-40, 31);
    ctx.lineTo(-12, 18);
    ctx.lineTo(12, 18);
    ctx.lineTo(40, 31);
    ctx.lineTo(69, 8);
    ctx.lineTo(80, -29);
    ctx.lineTo(16, -13);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(227,238,242,0.38)";
    ctx.lineWidth = 1.4;
    ctx.stroke();

    const hull = ctx.createLinearGradient(-30, -46, 30, 40);
    hull.addColorStop(0, "#e2e5e1");
    hull.addColorStop(0.24, "#77736a");
    hull.addColorStop(0.52, "#1a2025");
    hull.addColorStop(0.8, "#795738");
    hull.addColorStop(1, "#0c1115");
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.moveTo(0, -44);
    ctx.lineTo(31, -8);
    ctx.lineTo(24, 31);
    ctx.lineTo(0, 41);
    ctx.lineTo(-24, 31);
    ctx.lineTo(-31, -8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(244,246,240,0.45)";
    ctx.stroke();

    const sensor = ctx.createRadialGradient(-5, -15, 1, 0, -10, 21);
    sensor.addColorStop(0, "#efffff");
    sensor.addColorStop(0.24, "#67d9ef");
    sensor.addColorStop(0.58, "#17485a");
    sensor.addColorStop(1, "#061016");
    ctx.fillStyle = sensor;
    ctx.beginPath();
    ctx.ellipse(0, -10, 17, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(225,187,127,0.64)";
    ctx.beginPath();
    ctx.moveTo(-22, 13);
    ctx.lineTo(0, 25);
    ctx.lineTo(22, 13);
    ctx.moveTo(-55, -12);
    ctx.lineTo(-40, 16);
    ctx.moveTo(55, -12);
    ctx.lineTo(40, 16);
    ctx.stroke();
    for (const side of [-1, 1]) {
      roundRect(side * 50 - 5, 2, 10, 30, 3, "#12191e");
      ctx.fillStyle = "rgba(255,151,68,0.88)";
      ctx.fillRect(side * 50 - 2, 29, 4, 8 + Math.sin(phase * 13) * 2);
    }
    ctx.restore();
  }

  function drawBossDrone(x, y, healthRatio) {
    ctx.save();
    ctx.translate(x, y);
    drawGlow(0, 18, 138, "rgba(255, 115, 56, 0.2)");
    const armor = ctx.createLinearGradient(-116, -67, 116, 76);
    armor.addColorStop(0, "#e3e7e5");
    armor.addColorStop(0.16, "#717a7e");
    armor.addColorStop(0.44, "#171e23");
    armor.addColorStop(0.72, "#755338");
    armor.addColorStop(1, "#090d10");
    ctx.fillStyle = armor;
    ctx.beginPath();
    ctx.moveTo(0, -70);
    ctx.lineTo(47, -53);
    ctx.lineTo(118, -20);
    ctx.lineTo(101, 54);
    ctx.lineTo(41, 43);
    ctx.lineTo(0, 76);
    ctx.lineTo(-41, 43);
    ctx.lineTo(-101, 54);
    ctx.lineTo(-118, -20);
    ctx.lineTo(-47, -53);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(239,246,246,0.46)";
    ctx.lineWidth = 2;
    ctx.stroke();

    const core = ctx.createRadialGradient(-8, -7, 1, 0, 5, 38);
    core.addColorStop(0, "#fff");
    core.addColorStop(0.16, "#b9f7ff");
    core.addColorStop(0.4, "#38bad5");
    core.addColorStop(0.72, "#133d4d");
    core.addColorStop(1, "#040a0d");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.ellipse(0, 4, 35, 29, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 192, 113, ${0.35 + healthRatio * 0.55})`;
    ctx.lineWidth = 4;
    ctx.stroke();

    for (const side of [-1, 1]) {
      const pod = ctx.createLinearGradient(side * 96, -36, side * 68, 48);
      pod.addColorStop(0, "#bec5c5");
      pod.addColorStop(0.4, "#30383d");
      pod.addColorStop(1, "#080b0e");
      roundRect(side * 79 - 14, -30, 28, 67, 8, pod);
      roundRect(side * 79 - 8, -22, 16, 7, 3, "#93eaff");
    }
    ctx.restore();
  }

  function drawPlasmaPod(x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    const trail = ctx.createLinearGradient(0, -r * 4, 0, 0);
    trail.addColorStop(0, "rgba(255,94,37,0)");
    trail.addColorStop(0.7, "rgba(255,120,53,0.32)");
    trail.addColorStop(1, "rgba(255,232,177,0.85)");
    ctx.fillStyle = trail;
    ctx.beginPath();
    ctx.moveTo(-r * 0.45, -r * 0.45);
    ctx.lineTo(0, -r * 4);
    ctx.lineTo(r * 0.45, -r * 0.45);
    ctx.closePath();
    ctx.fill();
    drawGlow(0, 0, r * 3, "rgba(255, 164, 82, 0.24)");
    const shell = ctx.createRadialGradient(-r * 0.35, -r * 0.45, r * 0.08, 0, 0, r * 1.2);
    shell.addColorStop(0, "#f8ffff");
    shell.addColorStop(0.25, "#aebbc0");
    shell.addColorStop(0.6, "#3f4a50");
    shell.addColorStop(1, "#050708");
    ctx.fillStyle = shell;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.9, r * 1.2, -0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 193, 114, 0.62)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.68, r * 0.9, -0.12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawCover(img, x, y, w, h) {
    const iw = img.width;
    const ih = img.height;
    const scale = Math.max(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }

  function drawCentered(img, x, y, w, h) {
    ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
  }

  function drawGlow(x, y, r, color) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function roundRect(x, y, w, h, r, fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
    }
    ctx.fill();
  }

  function updateHud() {
    els.score.textContent = state.score.toLocaleString();
    els.lives.textContent = state.lives;
    els.wave.textContent = state.wave;
    els.gun.textContent = state.gun;
    els.mult.textContent = state.mult;
    els.bombs.textContent = state.bombs;
  }

  function toast(text) {
    els.toast.textContent = text;
    els.toast.classList.add("visible");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => els.toast.classList.remove("visible"), 900);
  }

  function pointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * W;
    pointer.y = ((event.clientY - rect.top) / rect.height) * H;
    pointer.active = true;
  }

  function key(event, down) {
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") input.left = down;
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") input.right = down;
    if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") input.up = down;
    if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") input.down = down;
    if (down && event.key === " ") useBomb();
    if (down && event.key.toLowerCase() === "f") toggleFullscreen();
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.querySelector(".realspace-arena")?.requestFullscreen?.();
  }

  function show(el) {
    el.classList.add("visible");
  }

  function hide(el) {
    el.classList.remove("visible");
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function frame(now) {
    const dt = Math.min(0.033, (now - (frame.last || now)) / 1000);
    frame.last = now;
    update(dt || 1 / 60);
    render();
    requestAnimationFrame(frame);
  }

  window.advanceTime = function (ms) {
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    for (let i = 0; i < steps; i += 1) update(1 / 60);
    render();
  };

  window.render_game_to_text = function () {
    return JSON.stringify({
      coordinateSystem: "origin top-left; x right; y down; canvas 720x1280",
      mode: state.mode,
      score: state.score,
      lives: state.lives,
      wave: state.wave,
      gun: state.gun,
      bombs: state.bombs,
      player: { x: Math.round(state.player.x), y: Math.round(state.player.y), shield: Number(state.player.shield.toFixed(1)) },
      enemies: state.enemies.slice(0, 8).map((e) => ({ type: e.type, x: Math.round(e.x), y: Math.round(e.y), hp: e.hp })),
      eggs: state.eggs.slice(0, 8).map((e) => ({ x: Math.round(e.x), y: Math.round(e.y) })),
      pickups: state.pickups.map((p) => ({ type: p.type, x: Math.round(p.x), y: Math.round(p.y) })),
    });
  };

  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerdown", pointerMove);
  window.addEventListener("keydown", (event) => key(event, true));
  window.addEventListener("keyup", (event) => key(event, false));
  document.getElementById("start-btn").addEventListener("click", reset);
  document.getElementById("restart-btn").addEventListener("click", reset);
  document.getElementById("play-again-btn").addEventListener("click", reset);
  document.getElementById("bomb-btn").addEventListener("click", useBomb);

  updateHud();
  render();
  window.ytgame?.game?.firstFrameReady?.();
  window.ytgame?.game?.gameReady?.();
  requestAnimationFrame(frame);
})();

