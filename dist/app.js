import {PeaSimulation, bodyPoseFromLandmarks} from './simulation.js?v=spatial-orbit-1';
import {PeaScene} from './scene.js?v=spatial-orbit-1';

const video = document.getElementById('video');
const overlay = document.getElementById('poseOverlay');
const ink = overlay.getContext('2d');
const joints = [11, 12, 13, 14, 15, 16, 23, 24];
const bones = [[11,12], [11,13], [13,15], [12,14], [14,16], [11,23], [12,24], [23,24]];
const bodyIcon = document.getElementById('bodyIcon');
const button = document.getElementById('cameraToggle');
const label = document.getElementById('buttonText');
const hint = document.getElementById('hint');
const framing = 'Keep your shoulders and hips in view.';

const sim = new PeaSimulation();
for (let i = 0; i < 1680; i++) {
  sim.setDirection(sim.time < 17 ? -.68 : .68);
  sim.step(.05);
}
let world;
let session = null;
let started = false;
let manual = false;
let manualDegrees = 0;
let paused = false;
let previousFrame = 0;
let errorTimer;

function showHint(message, error = false) {
  if (hint.textContent !== message) hint.textContent = message;
  hint.classList.toggle('error', error);
}

function beginGrowth() {
  if (!started) {
    sim.reset();
    world.reset();
    started = true;
  }
  world.overview = false;
}

function clearPose() {
  ink.clearRect(0, 0, overlay.width, overlay.height);
}

function drawPose(landmarks, body) {
  clearPose();
  if (!landmarks || !video.videoWidth || !video.videoHeight) return;
  const width = overlay.clientWidth, height = overlay.clientHeight;
  if (!width || !height) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.round(width * dpr), pixelHeight = Math.round(height * dpr);
  if (overlay.width !== pixelWidth) overlay.width = pixelWidth;
  if (overlay.height !== pixelHeight) overlay.height = pixelHeight;
  ink.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);

  // Use the same centered contain rectangle and CSS mirror as the live video.
  const scale = Math.min(width / video.videoWidth, height / video.videoHeight);
  const w = video.videoWidth * scale, h = video.videoHeight * scale;
  const project = p => [(width - w) / 2 + p.x * w, (height - h) / 2 + p.y * h];
  const points = new Map();
  for (const id of joints) {
    const p = landmarks[id];
    if (p && (p.visibility ?? 1) >= .55 && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1)
      points.set(id, project(p));
  }
  ink.strokeStyle = ink.fillStyle = '#C8DFC2';
  ink.lineWidth = 1.25;
  ink.lineCap = 'round';
  ink.beginPath();
  for (const [a, b] of bones) {
    if (!points.has(a) || !points.has(b)) continue;
    ink.moveTo(...points.get(a));
    ink.lineTo(...points.get(b));
  }
  ink.stroke();
  if (body) {
    ink.beginPath();
    ink.moveTo(...project(body.shoulders));
    ink.lineTo(...project(body.hips));
    ink.stroke();
  }
  for (const [x, y] of points.values()) {
    ink.beginPath();
    ink.arc(x, y, 2.4, 0, Math.PI * 2);
    ink.fill();
  }
}

function showCamera(live) {
  overlay.hidden = !live;
  if (!live) clearPose();
  video.hidden = !live;
  bodyIcon.hidden = live;
  label.textContent = live ? 'DISABLE CAMERA' : 'ENABLE CAMERA';
  button.setAttribute('aria-pressed', String(live));
}

function closeCamera(message) {
  const old = session;
  session = null;
  old?.stream?.getTracks().forEach(track => track.stop());
  video.pause();
  video.srcObject = null;
  old?.detector?.close();
  showCamera(false);
  button.disabled = false;
  clearTimeout(errorTimer);
  showHint(message || framing, Boolean(message));
  if (message) errorTimer = setTimeout(() => showHint(framing), 6500);
}

async function makeDetector() {
  const {FilesetResolver, PoseLandmarker} = await import('./vendor/mediapipe/vision_bundle.mjs');
  const files = await FilesetResolver.forVisionTasks(new URL('./vendor/mediapipe/wasm', import.meta.url).href);
  const options = {
    baseOptions: {modelAssetPath: new URL('./models/pose_landmarker_lite.task', import.meta.url).href, delegate: 'GPU'},
    runningMode: 'VIDEO', numPoses: 1, minPoseDetectionConfidence: .55,
    minPosePresenceConfidence: .55, minTrackingConfidence: .55
  };
  try {
    return await PoseLandmarker.createFromOptions(files, options);
  } catch {
    options.baseOptions.delegate = 'CPU';
    return PoseLandmarker.createFromOptions(files, options);
  }
}

async function openCamera() {
  clearTimeout(errorTimer);
  showHint(framing);
  if (!navigator.mediaDevices?.getUserMedia) {
    closeCamera('Camera access requires localhost or HTTPS.');
    return;
  }
  const current = {stream: null, detector: null, tracking: false, lastSeen: 0, lastInference: 0, lastVideoTime: -1};
  session = current;
  manual = false;
  button.disabled = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {width: {ideal: 640}, height: {ideal: 360}, facingMode: 'user'}, audio: false
    });
    if (session !== current) {
      stream.getTracks().forEach(track => track.stop());
      return;
    }
    current.stream = stream;
    for (const track of stream.getVideoTracks()) {
      track.addEventListener('ended', () => {
        if (session === current) closeCamera('Camera disconnected. Enable it to try again.');
      }, {once: true});
    }
    video.srcObject = stream;
    showCamera(true);
    button.disabled = false;
    await video.play();
    if (session !== current) return;
    const detector = await makeDetector();
    if (session !== current) {
      detector.close();
      return;
    }
    current.detector = detector;
    paused = false;
    beginGrowth();
  } catch (error) {
    if (session !== current) return;
    const denied = ['NotAllowedError', 'SecurityError'].includes(error.name);
    closeCamera(denied ? 'Allow camera access and try again.' : 'Camera unavailable. Please try again.');
  }
}

function infer(now) {
  const current = session;
  if (!current?.detector) return;
  if (current.tracking && now - current.lastSeen > 500) {
    current.tracking = false;
    showHint(framing);
  }
  if (video.readyState < 2 || video.currentTime === current.lastVideoTime) {
    if (current.lastInference && now - current.lastInference > 500) {
      clearPose();
      current.lastInference = 0;
    }
    return;
  }
  if (now - current.lastInference < 65) return;
  current.lastVideoTime = video.currentTime;
  current.lastInference = now;
  try {
    const {landmarks} = current.detector.detectForVideo(video, now);
    const body = bodyPoseFromLandmarks(landmarks?.[0], video.videoWidth / video.videoHeight);
    drawPose(landmarks?.[0], body);
    if (body) {
      sim.setDirection(body.direction);
      current.lastSeen = now;
      current.tracking = true;
      showHint('Lean left or right. The pea explores in 3D.');
    }
  } catch {
    closeCamera('Tracking interrupted. Enable the camera to retry.');
  }
}

button.addEventListener('click', () => session ? closeCamera() : openCamera());
window.addEventListener('pagehide', () => closeCamera());
window.addEventListener('keydown', event => {
  if (!world || event.altKey || event.ctrlKey || event.metaKey) return;
  if (!session && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
    event.preventDefault();
    beginGrowth();
    manual = true;
    manualDegrees = Math.max(-65, Math.min(65, manualDegrees + (event.key === 'ArrowLeft' ? -5 : 5)));
    sim.setDirection(manualDegrees * Math.PI / 180);
    showHint('Left / right to guide. The pea explores in 3D.');
  } else if (started && event.key.toLowerCase() === 'r') {
    sim.reset();
    world.reset();
    manualDegrees = 0;
  } else if (started && event.code === 'Space' && event.target !== button) {
    event.preventDefault();
    paused = !paused;
  }
});

function frame(now) {
  const dt = previousFrame ? Math.min((now - previousFrame) / 1000, .06) : 0;
  previousFrame = now;
  const visible = !document.hidden;
  if (visible) infer(now);
  const active = visible && !paused && (manual || session?.tracking === true);
  if (active) sim.step(dt);
  world.render(now / 1000, active);
  requestAnimationFrame(frame);
}

try {
  world = new PeaScene(document.getElementById('scene'), sim);
  requestAnimationFrame(frame);
} catch (error) {
  button.disabled = true;
  showHint('This scene requires a WebGL-enabled browser.', true);
  console.error(error);
}
