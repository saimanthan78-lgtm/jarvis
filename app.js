import * as THREE from "https://unpkg.com/three@0.162.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.162.0/examples/jsm/controls/OrbitControls.js";
import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12";

const PARTICLE_COUNT = 6000;
const STATUS = document.getElementById("status");
const TEMPLATE_INFO = document.getElementById("templateInfo");
const video = document.getElementById("webcam");
const overlay = document.getElementById("overlay");
const ctx = overlay.getContext("2d");

let handLandmarker;
let lastVideoTime = -1;
let lastSwipeX = 0;
let currentTemplate = 0;
let targetScale = 1;
let targetHue = 0.58;

const templates = [
  ["Heart", (u) => {
    const t = u * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    return new THREE.Vector3(x * 0.07, y * 0.07, (Math.random() - 0.5) * 0.8);
  }],
  ["Flower", (u) => {
    const t = u * Math.PI * 2;
    const r = 1 + 0.45 * Math.sin(6 * t);
    return new THREE.Vector3(r * Math.cos(t), r * Math.sin(t), (Math.random() - 0.5) * 0.45);
  }],
  ["Saturn", (u) => {
    const t = u * Math.PI * 2;
    const ringR = 1.45 + 0.25 * (Math.random() - 0.5);
    return new THREE.Vector3(
      ringR * Math.cos(t),
      0.15 * (Math.random() - 0.5),
      ringR * Math.sin(t) * 0.5
    );
  }],
  ["Firework", () => {
    const phi = Math.random() * Math.PI * 2;
    const costheta = Math.random() * 2 - 1;
    const theta = Math.acos(costheta);
    const r = Math.pow(Math.random(), 0.5) * 1.5;
    return new THREE.Vector3(
      r * Math.sin(theta) * Math.cos(phi),
      r * Math.sin(theta) * Math.sin(phi),
      r * Math.cos(theta)
    );
  }],
];

const namedTemplates = [
  "Spiral Galaxy", "DNA Helix", "Torus Knot", "Cube Shell", "Sphere", "Wave Grid",
  "Butterfly", "Infinity", "Meteor Trail", "Double Cone", "Vortex", "Snowflake",
  "Lotus", "Crown", "Aurora"
];

for (const name of namedTemplates) templates.push([name, proceduralTemplate(name)]);

function proceduralTemplate(name) {
  const fn = {
    "Spiral Galaxy": (u) => {
      const a = u * Math.PI * 10;
      const r = 0.08 + 1.7 * u;
      return new THREE.Vector3(r * Math.cos(a), 0.5 * (Math.random() - 0.5), r * Math.sin(a));
    },
    "DNA Helix": (u) => {
      const a = u * Math.PI * 14;
      const x = 0.65 * Math.cos(a);
      const y = (u - 0.5) * 3;
      const z = 0.65 * Math.sin(a);
      return new THREE.Vector3(x, y, z);
    },
    "Torus Knot": (u) => {
      const t = u * Math.PI * 2;
      const p = 2, q = 3;
      const r = 0.55 + 0.2 * Math.cos(q * t);
      return new THREE.Vector3(r * Math.cos(p * t), r * Math.sin(p * t), 0.4 * Math.sin(q * t));
    },
    "Cube Shell": () => new THREE.Vector3(...["x", "y", "z"].map(() => (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 0.95))),
    "Sphere": () => new THREE.Vector3().setFromSphericalCoords(1.2, Math.random() * Math.PI, Math.random() * Math.PI * 2),
    "Wave Grid": () => {
      const x = (Math.random() - 0.5) * 2.8;
      const z = (Math.random() - 0.5) * 2.8;
      const y = 0.35 * Math.sin(2.7 * x) * Math.cos(2.7 * z);
      return new THREE.Vector3(x, y, z);
    },
    "Butterfly": (u) => {
      const t = u * Math.PI * 12;
      const r = Math.exp(Math.cos(t)) - 2 * Math.cos(4 * t) + Math.pow(Math.sin((2 * t - Math.PI) / 24), 5);
      return new THREE.Vector3(0.25 * r * Math.cos(t), 0.25 * r * Math.sin(t), (Math.random() - 0.5) * 0.25);
    },
    "Infinity": (u) => {
      const t = u * Math.PI * 2;
      const d = 1 + Math.sin(t) * Math.sin(t);
      return new THREE.Vector3((Math.cos(t) / d) * 2, (Math.sin(t) * Math.cos(t) / d) * 2, (Math.random() - 0.5) * 0.2);
    },
    "Meteor Trail": (u) => new THREE.Vector3((u - 0.5) * 3, (Math.random() - 0.5) * 0.35, (Math.random() - 0.5) * 0.35),
    "Double Cone": (u) => {
      const h = (u - 0.5) * 3;
      const r = Math.abs(h) * 0.55;
      const a = Math.random() * Math.PI * 2;
      return new THREE.Vector3(r * Math.cos(a), h, r * Math.sin(a));
    },
    "Vortex": (u) => {
      const t = u * Math.PI * 10;
      const r = 0.25 + 1.2 * u;
      return new THREE.Vector3(r * Math.cos(t), (u - 0.5) * 2.5, r * Math.sin(t));
    },
    "Snowflake": (u) => {
      const arm = Math.floor(u * 6);
      const t = (arm / 6) * Math.PI * 2;
      const r = Math.random() * 1.4;
      return new THREE.Vector3(r * Math.cos(t), r * Math.sin(t), (Math.random() - 0.5) * 0.2);
    },
    "Lotus": (u) => {
      const t = u * Math.PI * 2;
      const r = 0.7 + 0.4 * Math.sin(8 * t);
      return new THREE.Vector3(r * Math.cos(t), 0.3 * Math.cos(4 * t), r * Math.sin(t));
    },
    "Crown": (u) => {
      const t = u * Math.PI * 2;
      const r = 1.1;
      const y = 0.6 + 0.4 * Math.abs(Math.sin(6 * t));
      return new THREE.Vector3(r * Math.cos(t), y, r * Math.sin(t));
    },
    "Aurora": (u) => {
      const x = (u - 0.5) * 4;
      const y = 0.6 * Math.sin(2 * x) + 0.25 * Math.sin(5 * x);
      return new THREE.Vector3(x, y, (Math.random() - 0.5) * 0.8);
    },
  };
  return fn[name];
}

const scene = new THREE.Scene();
scene.background = new THREE.Color("#030711");
const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0.8, 5);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.45;

const positions = new Float32Array(PARTICLE_COUNT * 3);
const targets = new Float32Array(PARTICLE_COUNT * 3);
const colors = new Float32Array(PARTICLE_COUNT * 3);

const geometry = new THREE.BufferGeometry();
geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

const material = new THREE.PointsMaterial({ size: 0.03, vertexColors: true, transparent: true, opacity: 0.95 });
const points = new THREE.Points(geometry, material);
scene.add(points);

scene.add(new THREE.AmbientLight(0x99aacc, 0.7));
const key = new THREE.DirectionalLight(0xffffff, 1.2);
key.position.set(3, 5, 4);
scene.add(key);

function setTemplate(index) {
  currentTemplate = (index + templates.length) % templates.length;
  const [name, generator] = templates[currentTemplate];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const v = generator(i / PARTICLE_COUNT);
    targets[i * 3] = v.x;
    targets[i * 3 + 1] = v.y;
    targets[i * 3 + 2] = v.z;
  }
  TEMPLATE_INFO.textContent = `Template: ${name} (${currentTemplate + 1}/${templates.length})`;
}

setTemplate(0);

async function initCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
  video.srcObject = stream;
  await video.play();
  overlay.width = video.videoWidth;
  overlay.height = video.videoHeight;
}

async function initHandTracking() {
  const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm");
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task" },
    runningMode: "VIDEO",
    numHands: 1,
  });
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function detectGesture(landmarks) {
  const thumb = landmarks[4];
  const index = landmarks[8];
  const middle = landmarks[12];
  const wrist = landmarks[0];

  const pinch = dist(thumb, index);
  const openness = Math.min(1, dist(wrist, middle) * 2.2);
  targetScale = THREE.MathUtils.clamp(0.55 + pinch * 5, 0.45, 2.9);
  targetHue = THREE.MathUtils.clamp(0.55 - openness * 0.48, 0.02, 0.62);

  const x = wrist.x;
  const dx = x - lastSwipeX;
  if (Math.abs(dx) > 0.09) {
    setTemplate(currentTemplate + (dx < 0 ? 1 : -1));
    lastSwipeX = x;
  }

  STATUS.textContent = `Pinch: ${pinch.toFixed(3)} | Openness: ${openness.toFixed(3)} | Scale: ${targetScale.toFixed(2)}`;
}

function drawHand(landmarks) {
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  ctx.fillStyle = "#80cbff";
  for (const lm of landmarks) {
    ctx.beginPath();
    ctx.arc((1 - lm.x) * overlay.width, lm.y * overlay.height, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function analyzeVideoFrame() {
  if (!handLandmarker || video.readyState < 2) return;
  if (lastVideoTime === video.currentTime) return;
  lastVideoTime = video.currentTime;

  const result = handLandmarker.detectForVideo(video, performance.now());
  if (result.landmarks.length) {
    const landmarks = result.landmarks[0];
    detectGesture(landmarks);
    drawHand(landmarks);
  } else {
    STATUS.textContent = "No hand detected — show one hand to interact.";
    ctx.clearRect(0, 0, overlay.width, overlay.height);
  }
}

function animate() {
  requestAnimationFrame(animate);
  analyzeVideoFrame();

  const hueBase = targetHue;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const p = i * 3;
    positions[p] += (targets[p] * targetScale - positions[p]) * 0.07;
    positions[p + 1] += (targets[p + 1] * targetScale - positions[p + 1]) * 0.07;
    positions[p + 2] += (targets[p + 2] * targetScale - positions[p + 2]) * 0.07;

    const hue = (hueBase + i / PARTICLE_COUNT * 0.15 + performance.now() * 0.00003) % 1;
    const c = new THREE.Color().setHSL(hue, 0.95, 0.6);
    colors[p] = c.r;
    colors[p + 1] = c.g;
    colors[p + 2] = c.b;
  }
  geometry.attributes.position.needsUpdate = true;
  geometry.attributes.color.needsUpdate = true;

  controls.update();
  renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

(async function boot() {
  try {
    await initCamera();
    await initHandTracking();
    STATUS.textContent = "Ready! Use your hand to control particles.";
  } catch (error) {
    STATUS.textContent = `Init failed: ${error.message}`;
  }
  animate();
})();
