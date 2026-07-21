import { exec, toast as ksuToast } from 'https://esm.sh/kernelsu@3.0.2';

const MODDIR = '/data/adb/modules/youyi_sched';
const CTL = `sh ${MODDIR}/bin/apm-ctl`;

const MODES = [
  { id: 'eco',         name: '省电模式', desc: '最低功耗，续航优先',           icon: '🌿', level: 0 },
  { id: 'balanced',    name: '均衡模式', desc: '日常使用的默认平衡',           icon: '⚖️', level: 1 },
  { id: 'performance', name: '性能模式', desc: '提升 CPU/GPU 下限',            icon: '🚀', level: 2 },
  { id: 'gaming',      name: '电竞模式', desc: '全性能 governor + 温控放宽',   icon: '🎮', level: 3 },
  { id: 'beast',       name: '满血模式', desc: '无温控限制，极限帧率',         icon: '🔥', level: 4 },
];

const MODE_MAP = Object.fromEntries(MODES.map(m => [m.id, m]));
const LEVEL_TO_MODE = MODES.map(m => m.id);
let currentModeId = 'balanced';
let switching = false;
let meterDragging = false;

// ── 工具函数 ──────────────────────────────────────────

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove('show'), 2800);
  try { ksuToast(msg); } catch (_) {}
}

async function runCmd(cmd) {
  const { errno, stdout, stderr } = await exec(cmd);
  const out = (stdout || '').trim();
  const err = (stderr || '').trim();
  if (errno !== 0) throw new Error(err || out || `命令失败 (${errno})`);
  return out;
}

function parseJsonLine(raw) {
  const lines = raw.trim().split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.startsWith('{')) return JSON.parse(line);
  }
  return JSON.parse(raw);
}

function showConfirm({ title, body, icon = '⚠️', confirmText = '确认', beast = false }) {
  return new Promise(resolve => {
    const overlay = document.getElementById('confirmModal');
    document.getElementById('confirmIcon').textContent = icon;
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmBody').textContent = body;
    document.getElementById('confirmOk').textContent = confirmText;
    overlay.classList.toggle('beast', beast);

    const cleanup = (result) => {
      overlay.classList.remove('show', 'beast');
      document.getElementById('confirmOk').removeEventListener('click', onOk);
      document.getElementById('confirmCancel').removeEventListener('click', onCancel);
      resolve(result);
    };
    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);

    document.getElementById('confirmOk').addEventListener('click', onOk);
    document.getElementById('confirmCancel').addEventListener('click', onCancel);
    overlay.classList.add('show');
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── 主题 & 性能条 ─────────────────────────────────────

function levelToPct(level) {
  return (level / 4) * 100;
}

function pctToLevel(pct) {
  return Math.max(0, Math.min(4, Math.round(pct * 4)));
}

function updatePowerTicks(level) {
  document.querySelectorAll('#powerTicks span').forEach(el => {
    const lv = parseInt(el.dataset.level, 10);
    el.classList.toggle('tick-active', lv === level);
  });
}

function applyThemePreview(level) {
  const pct = levelToPct(level);
  document.getElementById('powerFill').style.width = `${pct}%`;
  document.getElementById('powerThumb').style.left = `${pct}%`;
  document.getElementById('powerLevelText').textContent = `L${level}`;
  updatePowerTicks(level);

  const modeId = LEVEL_TO_MODE[level];
  if (modeId) {
    document.body.dataset.mode = modeId;
    const m = MODE_MAP[modeId];
    document.getElementById('currentMode').textContent = m.name;
  }
}

function applyTheme(modeId) {
  document.body.dataset.mode = modeId;
  const m = MODE_MAP[modeId];
  if (!m) return;

  const pct = levelToPct(m.level);
  document.getElementById('powerFill').style.width = `${pct}%`;
  document.getElementById('powerThumb').style.left = `${pct}%`;
  document.getElementById('powerLevelText').textContent = `L${m.level}`;
  updatePowerTicks(m.level);
}

function bumpChip() {
  const chip = document.getElementById('modeChip');
  chip.classList.remove('bump');
  void chip.offsetWidth;
  chip.classList.add('bump');
}

function flashHeroCard() {
  const card = document.querySelector('.hero-card');
  card.classList.remove('mode-flash');
  void card.offsetWidth;
  card.classList.add('mode-flash');
}

function flashStat(key) {
  const el = document.querySelector(`[data-stat="${key}"]`);
  if (!el) return;
  el.classList.remove('updated');
  void el.offsetWidth;
  el.classList.add('updated');
}

// ── 切换过渡动画 ──────────────────────────────────────

function showSwitchOverlay(modeId) {
  const m = MODE_MAP[modeId];
  document.getElementById('switchIcon').textContent = m.icon;
  document.getElementById('switchTitle').textContent = `切换至 ${m.name}`;
  document.getElementById('switchSub').textContent = '正在应用性能配置...';
  applyTheme(modeId);
  document.getElementById('switchOverlay').classList.add('show');
  document.querySelector('.app').classList.add('app-lock');
}

function hideSwitchOverlay() {
  document.getElementById('switchOverlay').classList.remove('show');
  document.querySelector('.app').classList.remove('app-lock');
}

// ── 涟漪点击效果 ──────────────────────────────────────

function addRipple(e, card) {
  const rect = card.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.cssText = `
    width:${size}px; height:${size}px;
    left:${e.clientX - rect.left - size / 2}px;
    top:${e.clientY - rect.top - size / 2}px;
  `;
  card.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
}

// ── 状态刷新 ──────────────────────────────────────────

async function refreshStatus(animate = false) {
  try {
    const raw = await runCmd(`${CTL} status`);
    const data = parseJsonLine(raw);
    const modeId = data.mode || 'balanced';
    const m = MODE_MAP[modeId];
    const modeChanged = modeId !== currentModeId;

    currentModeId = modeId;
    if (!meterDragging) {
      applyTheme(modeId);
    }

    if (modeChanged && animate) {
      bumpChip();
      flashHeroCard();
    }

    document.getElementById('currentMode').textContent = m?.name || modeId;

    const updates = [
      ['cpu0', 'cpuP0', data.cpu_governor_p0],
      ['cpu6', 'cpuP6', data.cpu_governor_p6],
      ['gpu',  'gpuLevel', data.gpu_min_pwrlevel ?? '--'],
    ];
    for (const [key, elId, val] of updates) {
      const el = document.getElementById(elId);
      if (el && el.textContent !== String(val)) {
        el.textContent = val || '--';
        if (animate) flashStat(key);
      }
    }

    const temp = parseInt(data.temp_zone17_mc, 10);
    const tempStr = isNaN(temp) ? '--' : `${(temp / 1000).toFixed(1)}°C`;
    const tempEl = document.getElementById('temp');
    if (tempEl.textContent !== tempStr) {
      tempEl.textContent = tempStr;
      if (animate) flashStat('temp');
    }

    document.getElementById('deviceBadge').textContent = data.device || 'unknown';

    const running = data.daemon && data.daemon !== 'stopped';
    document.getElementById('daemonDot').classList.toggle('on', running);
    document.getElementById('daemonStatus').textContent =
      running ? `守护进程运行中 · PID ${data.daemon}` : '守护进程未运行';

    updateActiveMode(modeId);
  } catch (e) {
    document.getElementById('daemonStatus').textContent = '状态获取失败: ' + e.message;
  }
}

function updateActiveMode(modeId) {
  document.querySelectorAll('.mode-card').forEach(card => {
    const active = card.dataset.mode === modeId;
    card.classList.toggle('active', active);
    card.style.pointerEvents = switching ? 'none' : '';
  });
}

// ── 切换档位 ──────────────────────────────────────────

async function setMode(modeId) {
  if (switching) return;
  const card = document.querySelector(`[data-mode="${modeId}"]`);
  if (card?.classList.contains('active')) return;

  if (modeId === 'beast') {
    const ok = await showConfirm({
      title: '开启满血模式',
      body: '满血模式将解除温控限制，CPU/GPU 持续满负荷运行，可能导致严重发热、耗电加快甚至硬件损伤。\n\n请确保你了解风险后再开启。',
      icon: '🔥',
      confirmText: '确认开启满血',
      beast: true,
    });
    if (!ok) return;
  }

  switching = true;
  showSwitchOverlay(modeId);

  // 卡片滑出动画
  document.querySelectorAll('.mode-card').forEach(c => {
    c.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
    if (c.dataset.mode === modeId) {
      c.style.transform = 'scale(1.02)';
      c.style.opacity = '1';
    } else {
      c.style.opacity = '0.5';
    }
  });

  try {
    const [raw] = await Promise.all([
      runCmd(`${CTL} set ${modeId}`),
      sleep(800),
    ]);

    const result = parseJsonLine(raw);
    if (result.ok === false) throw new Error('切换被拒绝');

    currentModeId = modeId;
    applyTheme(modeId);
    hideSwitchOverlay();
    await refreshStatus(true);
    showToast(`✓ 已切换至 ${result.name || MODE_MAP[modeId].name}`);

    // 成功弹跳
    const activeCard = document.querySelector(`[data-mode="${modeId}"]`);
    if (activeCard) {
      activeCard.style.transform = 'scale(1.04)';
      await sleep(150);
      activeCard.style.transform = '';
    }
  } catch (e) {
    hideSwitchOverlay();
    applyTheme(currentModeId);
    showToast('切换失败: ' + e.message);
  } finally {
    switching = false;
    document.querySelectorAll('.mode-card').forEach(c => {
      c.style.transition = '';
      c.style.opacity = '';
      c.style.transform = '';
    });
    updateActiveMode(currentModeId);
  }
}

// ── 性能条拖动切换 ────────────────────────────────────

function initPowerMeter() {
  const track = document.getElementById('powerTrack');
  if (!track) return;

  const getLevelFromClientX = (clientX) => {
    const rect = track.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    return pctToLevel(x / rect.width);
  };

  const finishDrag = async (clientX) => {
    if (!meterDragging) return;
    meterDragging = false;
    track.classList.remove('dragging');

    const level = getLevelFromClientX(clientX);
    const modeId = LEVEL_TO_MODE[level];

    if (modeId === currentModeId) {
      applyTheme(currentModeId);
      document.getElementById('currentMode').textContent = MODE_MAP[currentModeId].name;
      return;
    }

    await setMode(modeId);
  };

  track.addEventListener('pointerdown', (e) => {
    if (switching) return;
    meterDragging = true;
    track.classList.add('dragging');
    track.setPointerCapture(e.pointerId);
    applyThemePreview(getLevelFromClientX(e.clientX));
  });

  track.addEventListener('pointermove', (e) => {
    if (!meterDragging) return;
    applyThemePreview(getLevelFromClientX(e.clientX));
  });

  track.addEventListener('pointerup', (e) => finishDrag(e.clientX));
  track.addEventListener('pointercancel', (e) => {
    meterDragging = false;
    track.classList.remove('dragging');
    applyTheme(currentModeId);
    document.getElementById('currentMode').textContent = MODE_MAP[currentModeId].name;
  });

  document.querySelectorAll('#powerTicks span').forEach(el => {
    el.addEventListener('click', () => {
      const level = parseInt(el.dataset.level, 10);
      setMode(LEVEL_TO_MODE[level]);
    });
  });
}

// ── 渲染档位列表 ──────────────────────────────────────

function renderModes() {
  const list = document.getElementById('modeList');
  list.innerHTML = MODES.map(m => `
    <div class="mode-card ${m.id}" data-mode="${m.id}">
      <div class="mode-icon ${m.id}">${m.icon}</div>
      <div class="mode-info">
        <div class="mode-name">${m.name}</div>
        <div class="mode-desc">${m.desc}</div>
      </div>
      <div class="mode-aside">
        <span class="mode-level">L${m.level}</span>
        <span class="mode-check">✓</span>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.mode-card').forEach(card => {
    card.addEventListener('click', e => {
      addRipple(e, card);
      setMode(card.dataset.mode);
    });
  });
}

// ── 底部按钮 ──────────────────────────────────────────

async function withLoading(fn, successMsg) {
  if (switching) return;
  switching = true;
  document.querySelector('.app').classList.add('app-lock');
  try {
    await fn();
    if (successMsg) showToast(successMsg);
    await refreshStatus(true);
  } catch (e) {
    showToast('操作失败: ' + e.message);
  } finally {
    switching = false;
    document.querySelector('.app').classList.remove('app-lock');
  }
}

document.getElementById('btnReload').addEventListener('click', () =>
  withLoading(() => runCmd(`${CTL} reload`), '已重新应用'));

document.getElementById('btnRestore').addEventListener('click', async () => {
  const ok = await showConfirm({
    title: '恢复原厂设置',
    body: '将还原 CPU/GPU 调度器和温控参数到模块安装前的状态。',
    icon: '⟲',
    confirmText: '确认恢复',
  });
  if (!ok) return;
  withLoading(() => runCmd(`${CTL} restore`), '已恢复原厂');
});

document.getElementById('btnProbe').addEventListener('click', () =>
  withLoading(() => runCmd(`sh ${MODDIR}/bin/apm-probe`), '探测完成'));

// ── 启动 ──────────────────────────────────────────────

renderModes();
initPowerMeter();
refreshStatus(true);
setInterval(() => refreshStatus(false), 5000);
