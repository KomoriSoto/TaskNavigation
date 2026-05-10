'use strict';

// ──────────────────────────────────────────────────────────────────────────
// TaskNavigation — Concentration Tracker
// Uses MediaPipe FaceMesh to compute a real-time focus score from:
//   - Face direction (yaw / pitch deviation from centre)
//   - Eye gaze stability (iris movement)
//   - Face presence (is the user in frame?)
// Data format matches the Timely project's ConcentrationLog model.
// ──────────────────────────────────────────────────────────────────────────

const API_SAVE_URL = '/concentration/api/save/';

// ── State ──────────────────────────────────────────────────────────────────
let isRunning   = false;
let startTime   = null;
let timerHandle = null;
let snapshotHandle = null;

// Running metrics
let frameScores        = [];  // score each processed frame
let gazeHistory        = [];  // gaze deviation history (for stability)
let scoreRecords       = [];  // 5-min interval snapshots
let gazeStabilitySum   = 0;
let faceDirectionSum   = 0;
let centerFocusSum     = 0;
let metricsCount       = 0;

// Current frame values (displayed live)
let currentScore      = 0;
let currentGaze       = 0;
let currentFace       = 0;
let currentCenter     = 0;

// ── MediaPipe ──────────────────────────────────────────────────────────────
let faceMesh   = null;
let camera     = null;
let canvasCtx  = null;

const VIDEO  = document.getElementById('webcam');
const CANVAS = document.getElementById('output-canvas');

// Key landmark indices
const NOSE_TIP     = 4;
const LEFT_EYE     = 33;
const RIGHT_EYE    = 263;
const CHIN         = 152;
const FOREHEAD     = 10;
const LEFT_IRIS    = 468;
const RIGHT_IRIS   = 473;

// ── Focus chips ────────────────────────────────────────────────────────────
document.querySelectorAll('.focus-chip').forEach((chip) => {
  chip.addEventListener('click', () => chip.classList.toggle('selected'));
});

function getSelectedFocusItems() {
  return [...document.querySelectorAll('.focus-chip.selected')].map((c) => ({
    id:   parseInt(c.dataset.id),
    name: c.dataset.name,
  }));
}

// ── UI helpers ─────────────────────────────────────────────────────────────
function getCsrfToken() {
  return document.cookie.split(';')
    .map(c => c.trim())
    .find(c => c.startsWith('csrftoken='))
    ?.split('=')[1] ?? '';
}

function fmt1(n) { return isFinite(n) ? n.toFixed(1) : '—'; }
function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function updateRing(score) {
  const ring = document.getElementById('scoreRing');
  ring.style.setProperty('--pct', Math.min(100, Math.max(0, score)));
  ring.style.background =
    `conic-gradient(var(--color-primary) calc(${Math.min(100, score)} * 1%), #e2e8f0 0)`;
}

function updateUI() {
  document.getElementById('scoreValue').textContent = fmt1(currentScore);
  document.getElementById('hudScore').textContent   = fmt1(currentScore);
  document.getElementById('hudGaze').textContent    = fmt1(currentGaze * 100);
  updateRing(currentScore);

  document.getElementById('metGaze').textContent    = fmt1(currentGaze * 100);
  document.getElementById('metFace').textContent    = fmt1(currentFace * 100);
  document.getElementById('metPosture').textContent = '—';  // no posture sensor
  document.getElementById('metCenter').textContent  = fmt1(currentCenter * 100);

  document.getElementById('scoreStatus').textContent =
    currentScore >= 80 ? 'Excellent focus!' :
    currentScore >= 60 ? 'Good focus.'       :
    currentScore >= 40 ? 'Fair — stay on task.' :
    isRunning          ? 'Low focus. Realign with the screen.' : '';
}

function addHistoryBar(minute, score) {
  const container = document.getElementById('historyBars');
  const row = document.createElement('div');
  row.className = 'chart-row';
  row.innerHTML = `
    <span class="chart-label">${minute}m</span>
    <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${score}%;"></div></div>
    <span class="chart-value">${score.toFixed(1)}</span>`;
  container.appendChild(row);
  document.getElementById('historyCard').style.display = '';
}

// ── Timer & snapshots ──────────────────────────────────────────────────────
function startTimer() {
  timerHandle = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    document.getElementById('hudTime').textContent = fmtTime(elapsed);
  }, 1000);

  // 5-minute snapshots
  snapshotHandle = setInterval(() => {
    const elapsed = Math.round((Date.now() - startTime) / 60000);
    const avgScore = frameScores.length
      ? frameScores.reduce((a, b) => a + b, 0) / frameScores.length
      : 0;
    const snap = { minute: elapsed, score: parseFloat(avgScore.toFixed(2)) };
    scoreRecords.push(snap);
    addHistoryBar(elapsed, avgScore);
    frameScores = [];  // reset for next window
  }, 5 * 60 * 1000);
}

function stopTimer() {
  clearInterval(timerHandle);
  clearInterval(snapshotHandle);
}

// ── Score computation ──────────────────────────────────────────────────────
function computeScore(landmarks) {
  // 1. Face direction — deviation of nose tip from image centre
  const nose = landmarks[NOSE_TIP];
  const dx = (nose.x - 0.5) * 2;   // –1 … 1
  const dy = (nose.y - 0.5) * 2;
  const faceDeviation = Math.sqrt(dx * dx + dy * dy);  // 0 = perfect centre
  const faceScore = Math.max(0, 1 - faceDeviation * 2); // 0–1

  // 2. Gaze stability — iris movement over recent frames
  let gazeScore = 1;
  if (landmarks.length > 477) {
    const leftIris  = landmarks[LEFT_IRIS];
    const rightIris = landmarks[RIGHT_IRIS];
    const gazeX = (leftIris.x + rightIris.x) / 2;
    const gazeY = (leftIris.y + rightIris.y) / 2;

    gazeHistory.push({ x: gazeX, y: gazeY });
    if (gazeHistory.length > 30) gazeHistory.shift();

    if (gazeHistory.length >= 5) {
      const meanX = gazeHistory.reduce((a, p) => a + p.x, 0) / gazeHistory.length;
      const meanY = gazeHistory.reduce((a, p) => a + p.y, 0) / gazeHistory.length;
      const variance =
        gazeHistory.reduce((a, p) => a + (p.x - meanX) ** 2 + (p.y - meanY) ** 2, 0) /
        gazeHistory.length;
      gazeScore = Math.max(0, 1 - variance * 500);
    }
  }

  // 3. Center focus — how centred is the face horizontally
  const centerScore = Math.max(0, 1 - Math.abs(dx) * 1.5);

  // Weighted composite
  const total = (faceScore * 0.40 + gazeScore * 0.40 + centerScore * 0.20) * 100;

  currentGaze   = gazeScore;
  currentFace   = faceScore;
  currentCenter = centerScore;
  currentScore  = parseFloat(total.toFixed(1));

  // Accumulate for averages
  gazeStabilitySum += gazeScore;
  faceDirectionSum += faceScore;
  centerFocusSum   += centerScore;
  metricsCount++;

  frameScores.push(currentScore);
  return currentScore;
}

// ── MediaPipe setup ────────────────────────────────────────────────────────
function initFaceMesh() {
  faceMesh = new FaceMesh({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
  });

  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,   // enables iris landmarks (468+)
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  canvasCtx = CANVAS.getContext('2d');

  faceMesh.onResults((results) => {
    if (!isRunning) return;

    // Match canvas size to video
    CANVAS.width  = VIDEO.videoWidth;
    CANVAS.height = VIDEO.videoHeight;

    canvasCtx.clearRect(0, 0, CANVAS.width, CANVAS.height);

    if (results.multiFaceLandmarks?.length) {
      const lm = results.multiFaceLandmarks[0];
      computeScore(lm);
      drawFaceOutline(lm);
    } else {
      // No face detected
      currentScore = Math.max(0, currentScore - 2);
    }

    updateUI();
  });
}

function drawFaceOutline(landmarks) {
  // Draw simple ellipse around face
  const xs = landmarks.map(p => p.x * CANVAS.width);
  const ys = landmarks.map(p => p.y * CANVAS.height);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const rx = (Math.max(...xs) - Math.min(...xs)) / 2;
  const ry = (Math.max(...ys) - Math.min(...ys)) / 2;

  canvasCtx.strokeStyle = currentScore >= 60
    ? 'rgba(99,102,241,0.8)' : 'rgba(239,68,68,0.7)';
  canvasCtx.lineWidth = 2;
  canvasCtx.beginPath();
  canvasCtx.ellipse(cx, cy, rx * 1.1, ry * 1.1, 0, 0, Math.PI * 2);
  canvasCtx.stroke();
}

// ── Camera start / stop ────────────────────────────────────────────────────
async function startCamera() {
  initFaceMesh();
  camera = new Camera(VIDEO, {
    onFrame: async () => {
      if (isRunning) await faceMesh.send({ image: VIDEO });
    },
    width: 640,
    height: 480,
  });
  await camera.start();
}

function stopCamera() {
  camera?.stop();
}

// ── Session start / stop ───────────────────────────────────────────────────
document.getElementById('startBtn').addEventListener('click', async () => {
  document.getElementById('startBtn').style.display = 'none';
  document.getElementById('stopBtn').style.display  = '';
  document.getElementById('cameraHud').style.display   = '';
  document.getElementById('metricsCard').style.display = '';
  document.getElementById('cameraPlaceholder').style.display = 'none';

  isRunning  = true;
  startTime  = Date.now();
  frameScores = [];
  scoreRecords = [];
  gazeHistory = [];
  gazeStabilitySum = faceDirectionSum = centerFocusSum = metricsCount = 0;

  await startCamera();
  startTimer();
});

document.getElementById('stopBtn').addEventListener('click', async () => {
  isRunning = false;
  stopTimer();
  stopCamera();

  document.getElementById('startBtn').style.display = '';
  document.getElementById('stopBtn').style.display  = 'none';
  document.getElementById('cameraHud').style.display = 'none';
  document.getElementById('scoreStatus').textContent = 'Session ended. Saving…';

  await saveSession();
});

async function saveSession() {
  const durationMs = Date.now() - startTime;
  const durationMin = Math.max(1, Math.round(durationMs / 60000));

  const allScores = scoreRecords.map(r => r.score);
  if (frameScores.length) {
    allScores.push(frameScores.reduce((a, b) => a + b, 0) / frameScores.length);
  }

  const avgScore  = allScores.length ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;
  const maxScore  = allScores.length ? Math.max(...allScores) : 0;
  const minScore  = allScores.length ? Math.min(...allScores) : 0;
  const avgGaze   = metricsCount ? gazeStabilitySum / metricsCount * 100 : 0;
  const avgFace   = metricsCount ? faceDirectionSum / metricsCount * 100 : 0;
  const avgCenter = metricsCount ? centerFocusSum   / metricsCount * 100 : 0;

  const payload = {
    duration_minutes:   durationMin,
    average_score:      parseFloat(avgScore.toFixed(2)),
    max_score:          parseFloat(maxScore.toFixed(2)),
    min_score:          parseFloat(minScore.toFixed(2)),
    gaze_stability_avg: parseFloat(avgGaze.toFixed(2)),
    posture_score_avg:  null,
    face_direction_avg: parseFloat(avgFace.toFixed(2)),
    center_focus_avg:   parseFloat(avgCenter.toFixed(2)),
    score_records:      scoreRecords,
    focus_items:        getSelectedFocusItems(),
  };

  try {
    const res = await fetch(API_SAVE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('scoreStatus').textContent =
        `Saved! Average score: ${avgScore.toFixed(1)}`;
      setTimeout(() => { window.location.href = '/concentration/'; }, 1500);
    } else {
      document.getElementById('scoreStatus').textContent = 'Failed to save. Please try again.';
    }
  } catch {
    document.getElementById('scoreStatus').textContent = 'Network error. Could not save.';
  }
}
