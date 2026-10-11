(() => {
  'use strict';

  // ---- 常量配置 ----
  const COLS = 10;
  const ROWS = 20;
  const BLOCK = 30; // 逻辑像素，绘制时按比例缩放

  // 方块配色主题：经典（默认）与柔和（低饱和度）
  const THEMES = {
    classic: {
      nameZh: '经典',
      nameEn: 'Classic',
      I: '#22d3ee',
      O: '#fbbf24',
      T: '#a855f7',
      S: '#22c55e',
      Z: '#ef4444',
      J: '#3b82f6',
      L: '#f97316',
      ghost: 'rgba(148, 163, 184, 0.25)'
    },
    muted: {
      nameZh: '柔和',
      nameEn: 'Muted',
      I: '#8ec5d6',
      O: '#cfc08a',
      T: '#b9a3d1',
      S: '#9cc79c',
      Z: '#d19c9c',
      J: '#9cb3d1',
      L: '#d1b394',
      ghost: 'rgba(148, 163, 184, 0.16)'
    }
  };
  let theme = localStorage.getItem('tetris_theme') === 'muted' ? 'muted' : 'classic';
  const C = () => THEMES[theme];

  // 界面语言：中文（默认）/ English
  const I18N = {
    zh: {
      title: '阿皮的减脂小方块',
      score: '分数', level: '等级', lines: '行数',
      next: '下一个', best: '历史最高分',
      pause: '暂停', resume: '继续', restart: '重开',
      softDrop: '▼ 软降', hardDrop: '⤓ 硬降',
      start: '开始游戏', paused: '已暂停', gameOver: '游戏结束',
      scoreLabel: '得分：', newRecord: '新纪录！',
      emptyHistory: '暂无记录，玩一局吧',
      langBtn: 'EN', styleFmt: '风格：{n}'
    },
    en: {
      title: "Pipi's Tetris Game",
      score: 'Score', level: 'Level', lines: 'Lines',
      next: 'Next', best: 'Best Score',
      pause: 'Pause', resume: 'Resume', restart: 'Restart',
      softDrop: '▼ Soft Drop', hardDrop: '⤓ Hard Drop',
      start: 'Start Game', paused: 'Paused', gameOver: 'Game Over',
      scoreLabel: 'Score: ', newRecord: 'New Record!',
      emptyHistory: 'No records yet',
      langBtn: '中文', styleFmt: 'Style: {n}'
    }
  };
  let lang = localStorage.getItem('tetris_lang') === 'en' ? 'en' : 'zh';
  const T = () => I18N[lang];

  // 每个方块用 4x4 矩阵表示旋转状态
  const SHAPES = {
    I: [
      [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
      [[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]],
      [[0,0,0,0],[0,0,0,0],[1,1,1,1],[0,0,0,0]],
      [[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]]
    ],
    O: [
      [[1,1],[1,1]],
      [[1,1],[1,1]],
      [[1,1],[1,1]],
      [[1,1],[1,1]]
    ],
    T: [
      [[0,1,0],[1,1,1],[0,0,0]],
      [[0,1,0],[0,1,1],[0,1,0]],
      [[0,0,0],[1,1,1],[0,1,0]],
      [[0,1,0],[1,1,0],[0,1,0]]
    ],
    S: [
      [[0,1,1],[1,1,0],[0,0,0]],
      [[0,1,0],[0,1,1],[0,0,1]],
      [[0,0,0],[0,1,1],[1,1,0]],
      [[1,0,0],[1,1,0],[0,1,0]]
    ],
    Z: [
      [[1,1,0],[0,1,1],[0,0,0]],
      [[0,0,1],[0,1,1],[0,1,0]],
      [[0,0,0],[1,1,0],[0,1,1]],
      [[0,1,0],[1,1,0],[1,0,0]]
    ],
    J: [
      [[1,0,0],[1,1,1],[0,0,0]],
      [[0,1,1],[0,1,0],[0,1,0]],
      [[0,0,0],[1,1,1],[0,0,1]],
      [[0,1,0],[0,1,0],[1,1,0]]
    ],
    L: [
      [[0,0,1],[1,1,1],[0,0,0]],
      [[0,1,0],[0,1,0],[0,1,1]],
      [[0,0,0],[1,1,1],[1,0,0]],
      [[1,1,0],[0,1,0],[0,1,0]]
    ]
  };

  const PIECES = Object.keys(SHAPES);

  // ---- 状态 ----
  const board = createBoard();
  let current = null;
  let next = null;
  let score = 0;
  let lines = 0;
  let level = 1;
  let dropCounter = 0;
  let dropInterval = 800;
  let lastTime = 0;
  let running = false;
  let paused = false;
  let gameOver = false;
  let loopId = null;
  let best = Number(localStorage.getItem('tetris_best') || 0);
  let bestAtStart = best; // 本局开始时的最高分，用于判断新纪录
  let history = [];
  try { history = JSON.parse(localStorage.getItem('tetris_history') || '[]'); } catch (e) { history = []; }

  // 消行动画状态
  const CLEAR_DURATION = 380; // 动画时长 ms
  let clearingRows = [];      // 正在消除的行号
  let clearingStart = 0;      // 动画开始时间

  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const nextCanvas = document.getElementById('next');
  const nctx = nextCanvas.getContext('2d');

  // 设置画布实际尺寸（高分屏）
  function setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = COLS * BLOCK * dpr;
    canvas.height = ROWS * BLOCK * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function createBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  }

  function randomPiece() {
    const type = PIECES[Math.floor(Math.random() * PIECES.length)];
    return {
      type,
      rotation: 0,
      x: Math.floor((COLS - SHAPES[type][0][0].length) / 2),
      y: -1
    };
  }

  function getMatrix(piece) {
    return SHAPES[piece.type][piece.rotation % 4];
  }

  function collide(piece, offX = 0, offY = 0, rot = piece.rotation) {
    const matrix = SHAPES[piece.type][rot % 4];
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        if (!matrix[y][x]) continue;
        const nx = piece.x + x + offX;
        const ny = piece.y + y + offY;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  function merge() {
    const matrix = getMatrix(current);
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        if (matrix[y][x]) {
          const by = current.y + y;
          const bx = current.x + x;
          if (by >= 0) board[by][bx] = current.type;
        }
      }
    }
  }

  function detectFullRows() {
    const rows = [];
    for (let y = 0; y < ROWS; y++) {
      if (board[y].every(cell => cell)) rows.push(y);
    }
    return rows;
  }

  function removeClearedRows() {
    let removed = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (board[y].every(cell => cell)) {
        board.splice(y, 1);
        board.unshift(Array(COLS).fill(0));
        removed++;
        y++; // 重新检查当前行
      }
    }
    return removed;
  }

  // 动画结束后真正消行、计分并生成下一块
  function finishClearing() {
    const cleared = removeClearedRows();
    if (cleared > 0) {
      const points = [0, 100, 300, 500, 800][cleared] * level;
      score += points;
      lines += cleared;
      level = Math.floor(lines / 10) + 1;
      dropInterval = Math.max(100, 800 - (level - 1) * 60);
      if (score > best) {
        best = score;
        localStorage.setItem('tetris_best', best);
      }
      updateStats();
    }
    clearingRows = [];
    spawnNext();
    dropCounter = 0;
  }

  function spawnNext() {
    current = next;
    next = randomPiece();
    drawNext();
    if (collide(current, 0, 0)) {
      endGame();
    }
  }

  function canAct() {
    return running && !paused && !gameOver && current && clearingRows.length === 0;
  }

  function rotate(dir) {
    if (!canAct()) return;
    const oldRot = current.rotation;
    const newRot = (current.rotation + dir + 4) % 4;
    current.rotation = newRot;
    // 简单墙踢：尝试左右偏移
    const kicks = [0, -1, 1, -2, 2];
    for (const k of kicks) {
      if (!collide(current, k, 0)) {
        current.x += k;
        return;
      }
    }
    current.rotation = oldRot;
  }

  function move(dir) {
    if (!canAct()) return;
    if (!collide(current, dir, 0)) {
      current.x += dir;
    }
  }

  function softDrop() {
    if (!canAct()) return;
    if (!collide(current, 0, 1)) {
      current.y++;
      score += 1;
      updateStats();
    } else {
      lockPiece();
    }
    dropCounter = 0;
  }

  function hardDrop() {
    if (!canAct()) return;
    let dist = 0;
    while (!collide(current, 0, 1)) {
      current.y++;
      dist++;
    }
    score += dist * 2;
    lockPiece();
    updateStats();
  }

  function lockPiece() {
    merge();
    const full = detectFullRows();
    if (full.length > 0) {
      // 进入消行动画：先闪光淡出，再塌陷计分
      clearingRows = full;
      clearingStart = performance.now();
      current = null;
    } else {
      spawnNext();
    }
  }

  function getGhostY() {
    let y = current.y;
    while (!collide({ ...current, y: y + 1 })) {
      y++;
    }
    return y;
  }

  // ---- 绘制 ----
  function drawCell(context, x, y, color, size = BLOCK) {
    const px = x * size;
    const py = y * size;
    context.fillStyle = color;
    context.fillRect(px, py, size, size);
    // 高光
    context.fillStyle = 'rgba(255,255,255,0.25)';
    context.fillRect(px, py, size, size * 0.18);
    context.fillRect(px, py, size * 0.18, size);
    // 阴影
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.fillRect(px, py + size * 0.82, size, size * 0.18);
    context.fillRect(px + size * 0.82, py, size * 0.18, size);
    // 边框
    context.strokeStyle = 'rgba(0,0,0,0.4)';
    context.lineWidth = 1;
    context.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
  }

  function drawGrid() {
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 1; x < COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * BLOCK, 0);
      ctx.lineTo(x * BLOCK, ROWS * BLOCK);
      ctx.stroke();
    }
    for (let y = 1; y < ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * BLOCK);
      ctx.lineTo(COLS * BLOCK, y * BLOCK);
      ctx.stroke();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, COLS * BLOCK, ROWS * BLOCK);
    // 背景
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, COLS * BLOCK, ROWS * BLOCK);
    drawGrid();

    // 已落定方块（消行中的行播放动画：白色闪光 + 垂直压缩淡出）
    for (let y = 0; y < ROWS; y++) {
      const isClearing = clearingRows.includes(y);
      if (isClearing) {
        const p = Math.min(1, (performance.now() - clearingStart) / CLEAR_DURATION);
        ctx.save();
        ctx.globalAlpha = 1 - p;
        // 垂直向中心压缩
        ctx.translate(0, y * BLOCK + BLOCK / 2);
        ctx.scale(1, Math.max(0.02, 1 - p));
        ctx.translate(0, -(y * BLOCK + BLOCK / 2));
        for (let x = 0; x < COLS; x++) {
          if (board[y][x]) drawCell(ctx, x, y, C()[board[y][x]]);
        }
        // 白色闪光覆盖
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, y * BLOCK, COLS * BLOCK, BLOCK);
        ctx.restore();
      } else {
        for (let x = 0; x < COLS; x++) {
          if (board[y][x]) drawCell(ctx, x, y, C()[board[y][x]]);
        }
      }
    }

    if (current) {
      // 影子
      const ghostY = getGhostY();
      const matrix = getMatrix(current);
      for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < matrix[y].length; x++) {
          if (matrix[y][x]) {
            const gx = current.x + x;
            const gy = ghostY + y;
            if (gy >= 0) {
              ctx.fillStyle = C().ghost;
              ctx.fillRect(gx * BLOCK, gy * BLOCK, BLOCK, BLOCK);
              ctx.strokeStyle = 'rgba(148,163,184,0.5)';
              ctx.strokeRect(gx * BLOCK + 0.5, gy * BLOCK + 0.5, BLOCK - 1, BLOCK - 1);
            }
          }
        }
      }
      // 当前方块
      for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < matrix[y].length; x++) {
          if (matrix[y][x]) {
            const cx = current.x + x;
            const cy = current.y + y;
            if (cy >= 0) drawCell(ctx, cx, cy, C()[current.type]);
          }
        }
      }
    }
  }

  function drawNext() {
    const size = 20;
    nctx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    nctx.fillStyle = '#020617';
    nctx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    if (!next) return;
    const matrix = SHAPES[next.type][0];
    const w = matrix[0].length;
    const h = matrix.length;
    const offsetX = (nextCanvas.width - w * size) / 2;
    const offsetY = (nextCanvas.height - h * size) / 2;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (matrix[y][x]) {
          const px = offsetX + x * size;
          const py = offsetY + y * size;
          nctx.fillStyle = C()[next.type];
          nctx.fillRect(px, py, size, size);
          nctx.fillStyle = 'rgba(255,255,255,0.25)';
          nctx.fillRect(px, py, size, size * 0.18);
          nctx.fillRect(px, py, size * 0.18, size);
          nctx.strokeStyle = 'rgba(0,0,0,0.4)';
          nctx.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
        }
      }
    }
  }

  function updateStats() {
    document.getElementById('score').textContent = score;
    document.getElementById('level').textContent = level;
    document.getElementById('lines').textContent = lines;
    document.getElementById('best').textContent = best;
  }

  // 渲染历史记录面板（最高分 + 最近几局）
  function renderHistory() {
    document.getElementById('best').textContent = best;
    const list = document.getElementById('historyList');
    if (!history.length) {
      list.innerHTML = `<span class="empty">${T().emptyHistory}</span>`;
      return;
    }
    list.innerHTML = history.slice(0, 5).map(h =>
      `<div class="history-item"><span>${h.score}</span><span>${h.date}</span></div>`
    ).join('');
  }

  // 结束时记录本局成绩
  function saveHistory() {
    if (score <= 0) return;
    const d = new Date();
    const date = `${d.getMonth() + 1}/${d.getDate()}`;
    history.unshift({ score, date });
    history = history.slice(0, 10);
    localStorage.setItem('tetris_history', JSON.stringify(history));
    renderHistory();
  }

  // ---- 主循环 ----
  function update() {
    if (!running || paused || gameOver) return;
    const time = performance.now();
    try {
      const delta = time - lastTime;
      lastTime = time;
      // 消行动画进行中：暂停下落，动画结束后再塌陷
      if (clearingRows.length > 0) {
        if (time - clearingStart >= CLEAR_DURATION) {
          finishClearing();
        }
        draw();
        return;
      }
      dropCounter += delta;
      if (dropCounter > dropInterval) {
        if (!collide(current, 0, 1)) {
          current.y++;
        } else {
          lockPiece();
        }
        dropCounter = 0;
      }
      draw();
    } catch (e) {
      console.error('update error', e);
    }
  }

  function startLoop() {
    stopLoop();
    lastTime = performance.now();
    loopId = setInterval(update, 1000 / 30); // 30fps 对方块游戏足够且更省电
  }

  function stopLoop() {
    if (loopId) { clearInterval(loopId); loopId = null; }
  }

  // ---- 游戏控制 ----
  function startGame() {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) board[y][x] = 0;
    }
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 800;
    dropCounter = 0;
    clearingRows = [];
    gameOver = false;
    paused = false;
    running = true;
    bestAtStart = best;
    current = randomPiece();
    next = randomPiece();
    updateStats();
    drawNext();
    hideOverlay();
    setPauseBtn();
    draw();
    startLoop();
  }

  function endGame() {
    gameOver = true;
    running = false;
    stopLoop();
    saveHistory();
    const isNewRecord = score > bestAtStart && score > 0;
    showOverlay(T().gameOver, score, false, isNewRecord);
  }

  function togglePause() {
    if (gameOver || !running) return;
    paused = !paused;
    setPauseBtn();
    if (!paused) {
      startLoop();
    } else {
      stopLoop();
      showOverlay(T().paused, null, true);
    }
  }

  function setPauseBtn() {
    document.getElementById('btnPause').textContent = paused ? T().resume : T().pause;
  }

  // 应用界面语言到所有静态文本与动态按钮
  function applyLang() {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.title = T().title;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = T()[el.dataset.i18n];
    });
    document.getElementById('btnLang').textContent = T().langBtn;
    applyThemeBtn();
    setPauseBtn();
    renderHistory();
    // 弹窗若正在显示，同步其文案
    if (!overlay.classList.contains('hidden')) {
      overlayTitle.textContent = gameOver ? T().gameOver : (paused ? T().paused : T().title);
      document.getElementById('btnStart').textContent = paused ? T().resume : T().start;
    }
  }

  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const finalScore = document.getElementById('finalScore');
  const overlayScoreEl = finalScore.parentElement;

  function showOverlay(title, scoreVal, isPause = false, isRecord = false) {
    overlayTitle.textContent = title;
    document.getElementById('newRecord').classList.toggle('hidden', !isRecord);
    if (scoreVal === null) {
      overlayScoreEl.style.display = 'none';
    } else {
      overlayScoreEl.style.display = '';
      finalScore.textContent = scoreVal;
    }
    const startBtn = document.getElementById('btnStart');
    startBtn.textContent = isPause ? T().resume : T().start;
    startBtn.onclick = isPause ? togglePause : startGame;
    overlay.classList.remove('hidden');
  }

  function hideOverlay() {
    overlay.classList.add('hidden');
  }

  // ---- 键盘控制 ----
  document.addEventListener('keydown', (e) => {
    if (!running || gameOver) return;
    if (paused) {
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') togglePause();
      return;
    }
    switch (e.key) {
      case 'ArrowLeft': move(-1); break;
      case 'ArrowRight': move(1); break;
      case 'ArrowDown': softDrop(); break;
      case 'ArrowUp':
      case 'x':
      case 'X': rotate(1); break;
      case 'z':
      case 'Z': rotate(-1); break;
      case ' ': e.preventDefault(); hardDrop(); break;
      case 'p':
      case 'P':
      case 'Escape': togglePause(); break;
    }
    draw();
  });

  // ---- 触屏控制 ----
  const touchArea = canvas;
  let touchStartX = 0, touchStartY = 0, touchStartTime = 0;
  let touchMoved = false;
  const SWIPE_THRESHOLD = 24;
  const TAP_MAX_DIST = 12;
  const TAP_MAX_TIME = 300;

  touchArea.addEventListener('touchstart', (e) => {
    if (!running || gameOver || paused) return;
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchStartTime = Date.now();
    touchMoved = false;
  }, { passive: true });

  touchArea.addEventListener('touchmove', (e) => {
    if (!running || gameOver || paused) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    if (Math.abs(dx) > SWIPE_THRESHOLD || Math.abs(dy) > SWIPE_THRESHOLD) {
      touchMoved = true;
    }
  }, { passive: true });

  touchArea.addEventListener('touchend', (e) => {
    if (!running || gameOver || paused) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    const dt = Date.now() - touchStartTime;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (!touchMoved && absX < TAP_MAX_DIST && absY < TAP_MAX_DIST && dt < TAP_MAX_TIME) {
      rotate(1); // 点击画布旋转
      draw();
      return;
    }

    if (absX > absY) {
      // 水平滑动
      const steps = Math.floor(absX / 28);
      for (let i = 0; i < Math.max(1, steps); i++) {
        move(dx > 0 ? 1 : -1);
      }
    } else {
      // 垂直滑动
      if (dy > 0) {
        if (dy > 120) {
          hardDrop(); // 长下滑 = 硬降
        } else {
          softDrop(); // 短下滑 = 软降
        }
      }
    }
    draw();
  }, { passive: true });

  // ---- 按钮控制 ----
  function bindBtn(id, action) {
    const btn = document.getElementById(id);
    let interval = null;
    const start = (e) => {
      e.preventDefault();
      action();
      draw();
      // 长按重复（左右、软降）
      if (id === 'btnLeft' || id === 'btnRight' || id === 'btnDown') {
        interval = setInterval(() => { action(); draw(); }, 90);
      }
    };
    const stop = () => { if (interval) { clearInterval(interval); interval = null; } };
    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('touchend', stop);
    btn.addEventListener('touchcancel', stop);
    btn.addEventListener('mousedown', start);
    btn.addEventListener('mouseup', stop);
    btn.addEventListener('mouseleave', stop);
  }

  bindBtn('btnLeft', () => move(-1));
  bindBtn('btnRight', () => move(1));
  bindBtn('btnRotate', () => rotate(1));
  bindBtn('btnDown', softDrop);
  bindBtn('btnDrop', hardDrop);

  document.getElementById('btnPause').addEventListener('click', togglePause);
  document.getElementById('btnRestart').addEventListener('click', startGame);

  // 方块风格切换
  const btnTheme = document.getElementById('btnTheme');
  function applyThemeBtn() {
    btnTheme.textContent = T().styleFmt.replace('{n}', lang === 'zh' ? C().nameZh : C().nameEn);
  }
  btnTheme.addEventListener('click', () => {
    theme = theme === 'classic' ? 'muted' : 'classic';
    localStorage.setItem('tetris_theme', theme);
    applyThemeBtn();
    draw();
    drawNext();
  });

  // 语言切换
  document.getElementById('btnLang').addEventListener('click', () => {
    lang = lang === 'zh' ? 'en' : 'zh';
    localStorage.setItem('tetris_lang', lang);
    applyLang();
  });

  // ---- 初始化 ----
  window.addEventListener('resize', () => { setupCanvas(); draw(); drawNext(); });
  setupCanvas();
  updateStats();
  renderHistory();
  applyThemeBtn();
  drawNext();
  draw();
  showOverlay(T().title, null, false);
  document.getElementById('btnStart').onclick = startGame;
  applyLang();
})();
