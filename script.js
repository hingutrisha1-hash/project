// Mini Subway Surfer-like runner (no images, canvas shapes)
// Controls: Left/Right arrows (A/D), Up/Space to jump. Mobile: tap left/right halves or use onscreen buttons.

(() => {
  const canvas = document.getElementById('game');
  const scoreEl = document.getElementById('score');
  const speedEl = document.getElementById('speed');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayScore = document.getElementById('overlay-score');
  const restartBtn = document.getElementById('restart');

  // Onscreen buttons
  document.getElementById('left').addEventListener('click', () => player.moveLeft());
  document.getElementById('right').addEventListener('click', () => player.moveRight());
  document.getElementById('jump').addEventListener('click', () => player.jump());

  // Resize canvas to displayed size (high-res aware)
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const ctx = canvas.getContext('2d');

  // Game constants
  const LANES = 3;
  let laneX = []; // filled on resize
  const groundY = 420; // visual ground baseline (px)
  let running = true;

  // Player
  const player = {
    lane: 1,
    x: 0,
    y: groundY,
    width: 52,
    height: 72,
    vy: 0,
    onGround: true,
    color: '#ffcc33',
    jumpStrength: -13,
    moveLeft() { if (!running) return; this.lane = Math.max(0, this.lane - 1); },
    moveRight(){ if (!running) return; this.lane = Math.min(LANES-1, this.lane + 1); },
    jump() {
      if (!running) return;
      if (this.onGround) {
        this.vy = this.jumpStrength;
        this.onGround = false;
      }
    },
    update(dt) {
      // horizontal lerp to lane
      const targetX = laneX[this.lane] - this.width/2;
      this.x += (targetX - this.x) * Math.min(12 * dt, 1);

      // vertical physics
      this.vy += 30 * dt; // gravity
      this.y += this.vy;
      if (this.y >= groundY) {
        this.y = groundY;
        this.vy = 0;
        this.onGround = true;
      }
    },
    draw(ctx) {
      // simple runner: body and head
      ctx.fillStyle = this.color;
      // legs shadow
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(this.x + 8, this.y + this.height - 6, this.width - 16, 6);
      ctx.fillStyle = this.color;
      // body
      ctx.fillRect(this.x, this.y, this.width, this.height - 16);
      // head
      ctx.beginPath();
      ctx.arc(this.x + this.width - 12, this.y + 10, 12, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // Obstacles
  let obstacles = [];
  function createObstacle(speed) {
    const lane = Math.floor(Math.random() * LANES);
    const w = 36 + Math.random()*22;
    const h = 36 + Math.random()*40;
    const gap = 30 + Math.random()*60;
    // spawn offscreen right
    const x = canvas.clientWidth + 100;
    return {lane, x, y: groundY + (player.height - h), w, h, speed};
  }

  // Game variables
  let lastTime = 0;
  let spawnTimer = 0;
  let spawnInterval = 1.1; // seconds (decreases with speed)
  let score = 0;
  let gameSpeed = 220; // px/s baseline
  let speedFactor = 1.0;
  let gameOver = false;

  function resetGame() {
    obstacles = [];
    spawnTimer = 0;
    spawnInterval = 1.1;
    score = 0;
    gameSpeed = 220;
    speedFactor = 1.0;
    running = true;
    gameOver = false;
    overlay.classList.add('hidden');
    player.lane = 1;
    player.x = laneX[player.lane] - player.width/2;
    player.y = groundY;
    player.vy = 0;
    player.onGround = true;
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function endGame() {
    running = false;
    gameOver = true;
    overlay.classList.remove('hidden');
    overlayTitle.textContent = 'Game Over';
    overlayScore.textContent = `Score: ${Math.floor(score)}`;
  }

  restartBtn.addEventListener('click', () => resetGame());

  // Controls
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') player.moveLeft();
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') player.moveRight();
    if (e.key === 'ArrowUp' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      player.jump();
    }
    if (!running && (e.key === 'Enter')) resetGame();
  });

  // Mobile touch split area
  canvas.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = t.clientX - rect.left;
    if (x < rect.width * 0.33) player.moveLeft();
    else if (x > rect.width * 0.66) player.moveRight();
    else player.jump();
  }, {passive:true});

  // Resize observer to recompute lanes
  function computeLayout() {
    const padding = 80;
    const w = canvas.clientWidth;
    const usable = w - padding*2;
    laneX = [];
    for (let i=0;i<LANES;i++){
      laneX.push(padding + usable * (i/(LANES-1)));
    }
    player.x = laneX[player.lane] - player.width/2;
  }

  // Collision detection (AABB)
  function hitTest(a, b) {
    return !(a.x + a.width < b.x || a.x > b.x + b.w || a.y + a.height < b.y || a.y > b.y + b.h);
  }

  function loop(now) {
    if (!lastTime) lastTime = now;
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    // increase difficulty over time
    score += dt * 60 * speedFactor;
    speedFactor += dt * 0.01; // slowly ramp up
    spawnInterval = Math.max(0.45, 1.1 - (speedFactor - 1) * 0.14);

    // spawn obstacles
    spawnTimer += dt;
    if (spawnTimer >= spawnInterval) {
      spawnTimer = 0;
      obstacles.push(createObstacle(gameSpeed * speedFactor * (0.9 + Math.random()*0.3)));
    }

    // update player
    player.update(dt);

    // update obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const ob = obstacles[i];
      ob.x -= ob.speed * dt;
      ob.y = groundY + (player.height - ob.h);
      // collision check against player bounding box
      const pb = {x: player.x, y: player.y, width: player.width, height: player.height};
      const obb = {x: ob.x, y: ob.y, w: ob.w, h: ob.h};
      if (hitTest(pb, obb)) {
        endGame();
      }
      // remove offscreen
      if (ob.x + ob.w < -200) obstacles.splice(i, 1);
    }

    // draw
    draw();

    // update UI
    scoreEl.textContent = `Score: ${Math.floor(score)}`;
    speedEl.textContent = `Speed: ${speedFactor.toFixed(2)}x`;

    if (!gameOver) requestAnimationFrame(loop);
  }

  function draw() {
    // clear
    ctx.clearRect(0,0,canvas.clientWidth, canvas.clientHeight);

    // background rails/streets
    for (let i=0;i<LANES;i++){
      const x = laneX[i];
      // lane markers
      ctx.fillStyle = i%2 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.01)';
      ctx.fillRect(0, groundY + player.height + 16 + (i%2?6:0), canvas.clientWidth, 40);
      // vertical guide lines
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(x-1, 0, 2, canvas.clientHeight);
    }

    // draw obstacles (simple crates/cones)
    obstacles.forEach(ob => {
      ctx.save();
      const cx = ob.x;
      const cy = ob.y;
      // shadow
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(cx+6, cy + ob.h - 6, ob.w - 6, 6);

      // body
      ctx.fillStyle = '#d14d4d';
      ctx.fillRect(cx, cy, ob.w, ob.h);

      // stripes
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(cx+6, cy+6, ob.w-12, 6);
      ctx.restore();
    });

    // draw player on top
    player.draw(ctx);

    // HUD-ish ground line
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.beginPath();
    ctx.moveTo(0, groundY + player.height + 8);
    ctx.lineTo(canvas.clientWidth, groundY + player.height + 8);
    ctx.stroke();
  }

  // On initial load set canvas size and compute lanes
  function init() {
    // set a sensible canvas aspect ratio
    canvas.style.width = '960px';
    canvas.style.height = '520px';
    resize();
    computeLayout();
    window.addEventListener('resize', () => {
      resize();
      computeLayout();
    });
    resetGame();
  }

  // Start
  init();

  // expose for debugging on window
  window.__subway = {player, obstacles};
})();