import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { getRecords } from './app.js';

const THEME_WORDS = ['团队', '研究', '数据', '领导', '表达', '合作', '竞赛', '问题', '社区', '演出', '设计', '实验', '调研', '主持', '创新', '写作', '艺术', '体育', '学术', '探索'];
const TONES = [
  { ink:'#295b4b', soft:'#e7f0e9', accent:'#76a58e' },
  { ink:'#9b4f2d', soft:'#f8e8de', accent:'#d58a61' },
  { ink:'#3b5974', soft:'#e6edf4', accent:'#7e9db6' },
  { ink:'#746127', soft:'#f3edd6', accent:'#b9a24d' },
  { ink:'#714553', soft:'#f1e6ea', accent:'#a87988' }
];

function categoryTone(category) {
  let hash = 0;
  for (const char of String(category || '待分类')) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return TONES[Math.abs(hash) % TONES.length];
}

function recordTerms(record) {
  const source = [record.title, record.description, record.aiDescription].filter(Boolean).join('');
  const terms = new Set((record.keywords || []).map(String));
  THEME_WORDS.forEach((word) => { if (source.includes(word)) terms.add(word); });
  return terms;
}

function dayDistance(left, right) {
  const a = Date.parse(left || '');
  const b = Date.parse(right || '');
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Infinity;
  return Math.abs(a - b) / 86400000;
}

function relationScore(left, right) {
  let score = left.category && left.category === right.category ? 5 : 0;
  const rightTerms = recordTerms(right);
  recordTerms(left).forEach((term) => { if (rightTerms.has(term)) score += 3; });
  const days = dayDistance(left.date, right.date);
  if (days <= 60) score += 3;
  else if (days <= 180) score += 2;
  else if (days <= 365) score += 1;
  return score;
}

function surfaceAngle(left, right) {
  return Math.acos(THREE.MathUtils.clamp(
    left.clone().normalize().dot(right.clone().normalize()),
    -1,
    1
  ));
}

function buildConnections(records, positions) {
  if (records.length < 2) return [];
  const linksPerRecord = records.length <= 8 ? 2 : 3;
  const edges = new Map();

  records.forEach((record, index) => {
    const candidates = records.map((other, otherIndex) => ({
      index:otherIndex,
      score:otherIndex === index ? -1 : relationScore(record, other),
      angle:otherIndex === index ? Infinity : surfaceAngle(positions[index], positions[otherIndex])
    })).filter((item) => item.index !== index)
      .sort((a, b) => a.angle - b.angle || b.score - a.score || a.index - b.index)
      .slice(0, Math.min(linksPerRecord, records.length - 1));

    candidates.forEach((candidate) => {
      const start = Math.min(index, candidate.index);
      const end = Math.max(index, candidate.index);
      const key = start + ':' + end;
      const previous = edges.get(key);
      if (!previous || candidate.score > previous.score) edges.set(key, { start, end, score:candidate.score });
    });
  });

  return Array.from(edges.values());
}

function layoutPositions(count) {
  if (count === 1) return [new THREE.Vector3(0, 0, 0)];
  if (count === 2) return [new THREE.Vector3(-2.8, 0, 0), new THREE.Vector3(2.8, 0, 0)];
  if (count === 3) {
    return [0, 1, 2].map((index) => {
      const angle = Math.PI / 2 + index * Math.PI * 2 / 3;
      return new THREE.Vector3(Math.cos(angle) * 3.7, Math.sin(angle) * 3.7, 0);
    });
  }
  if (count === 4) {
    return [[1,1,1], [1,-1,-1], [-1,1,-1], [-1,-1,1]].map((point) => new THREE.Vector3(...point).normalize().multiplyScalar(4));
  }

  const radius = 3.7 + Math.min(4.7, Math.sqrt(count) * 0.66);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length:count }, (_, index) => {
    const y = 1 - index / (count - 1) * 2;
    const ring = Math.sqrt(1 - y * y);
    const angle = goldenAngle * index;
    return new THREE.Vector3(Math.cos(angle) * ring, y, Math.sin(angle) * ring).multiplyScalar(radius);
  });
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function drawWrappedTitle(context, text, x, y, maxWidth, lineHeight) {
  const chars = Array.from(text || '未命名经历');
  const lines = [];
  let line = '';
  chars.forEach((char) => {
    const candidate = line + char;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = char;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  const visible = lines.slice(0, 2);
  if (lines.length > 2) {
    while (context.measureText(visible[1] + '…').width > maxWidth) visible[1] = visible[1].slice(0, -1);
    visible[1] += '…';
  }
  visible.forEach((item, index) => context.fillText(item, x, y + index * lineHeight));
}

function makeCardTexture(record, index) {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  const context = canvas.getContext('2d');
  const tone = categoryTone(record.category);

  context.shadowColor = 'rgba(24, 42, 33, .18)';
  context.shadowBlur = 22;
  context.shadowOffsetY = 10;
  roundedRect(context, 24, 18, 592, 314, 22);
  context.fillStyle = '#ffffff';
  context.fill();
  context.shadowColor = 'transparent';
  context.strokeStyle = '#dce3dd';
  context.lineWidth = 2;
  context.stroke();

  roundedRect(context, 24, 18, 12, 314, 6);
  context.fillStyle = tone.accent;
  context.fill();

  context.font = '500 22px "Noto Sans SC", sans-serif';
  const category = record.category || '待分类';
  const categoryWidth = Math.min(210, context.measureText(category).width + 34);
  roundedRect(context, 58, 50, categoryWidth, 42, 8);
  context.fillStyle = tone.soft;
  context.fill();
  context.fillStyle = tone.ink;
  context.textBaseline = 'middle';
  context.fillText(category, 75, 72);

  context.fillStyle = '#8a918b';
  context.textAlign = 'right';
  context.font = '500 20px "DM Mono", monospace';
  context.fillText((record.date || 'DATE TBD').replaceAll('-', ' / '), 582, 72);

  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  context.fillStyle = '#171a18';
  context.font = '700 36px "Noto Sans SC", "Manrope", sans-serif';
  drawWrappedTitle(context, record.title, 58, 158, 510, 52);

  context.fillStyle = '#8a918b';
  context.font = '500 18px "DM Mono", monospace';
  context.fillText('EVENT ' + String(index + 1).padStart(2, '0'), 58, 290);
  context.textAlign = 'right';
  context.fillStyle = tone.ink;
  context.fillText('↗', 578, 290);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = 4;
  return texture;
}

function formatDate(date) {
  return date ? date.replaceAll('-', ' / ') : '待补充时间';
}

function initAtlas() {
  const stage = document.getElementById('atlas-stage') || document.getElementById('home-atlas-stage');
  if (!stage) return;
  const isHomeView = stage.dataset.atlasContext === 'home';
  const idPrefix = isHomeView ? 'home-atlas' : 'atlas';

  const records = getRecords();
  const positions = layoutPositions(records.length);
  const connections = buildConnections(records, positions);
  const recordCount = document.getElementById('atlas-record-count');
  const edgeCount = document.getElementById('atlas-edge-count');
  const recordLinks = document.getElementById(idPrefix + '-record-links');
  if (recordCount) recordCount.textContent = String(records.length);
  if (edgeCount) edgeCount.textContent = String(connections.length);
  if (recordLinks) recordLinks.innerHTML = records.map((record) => '<a href="/detail?id=' + encodeURIComponent(record.id) + '">' + String(record.title || '未命名经历').replace(/[&<>"']/g, '') + '</a>').join('');

  const loading = document.getElementById(idPrefix + '-loading');
  if (!records.length) {
    if (loading) loading.hidden = true;
    const empty = document.getElementById(idPrefix + '-empty');
    if (empty) empty.hidden = false;
    return;
  }

  const scene = new THREE.Scene();
  scene.background = isHomeView ? null : new THREE.Color('#edf1ec');
  const radius = Math.max(4, ...positions.map((position) => position.length()));
  const homeScale = isHomeView ? 1.08 : 1;
  const cardWidth = (records.length <= 6 ? 2.75 : records.length <= 20 ? 2.15 : records.length <= 60 ? 1.7 : 1.35) * homeScale;
  const cardHeight = cardWidth * 0.5625;

  function fittedDistance(width, height) {
    const fieldOfView = width < 600 ? 52 : 42;
    const aspect = Math.max(0.2, width / Math.max(1, height));
    const halfVertical = THREE.MathUtils.degToRad(fieldOfView / 2);
    const halfHorizontal = Math.atan(Math.tan(halfVertical) * aspect);
    const graphExtent = radius + cardWidth * 0.55;
    return Math.max(graphExtent / Math.tan(halfVertical), graphExtent / Math.tan(halfHorizontal)) * 1.04;
  }

  const camera = new THREE.PerspectiveCamera(stage.clientWidth < 600 ? 52 : 42, 1, 0.1, 120);
  let currentFitDistance = fittedDistance(stage.clientWidth, stage.clientHeight);
  const cameraDirection = new THREE.Vector3(0.04, 0.025, 1).normalize();
  camera.position.copy(cameraDirection).multiplyScalar(currentFitDistance);

  const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:isHomeView, powerPreference:'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  if (isHomeView) renderer.setClearAlpha(0);
  renderer.domElement.setAttribute('aria-label', isHomeView ? '自动旋转的时间星球' : '可旋转的事件关系图');
  stage.prepend(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.enablePan = false;
  controls.enableZoom = !isHomeView;
  controls.enableRotate = true;
  controls.minDistance = Math.max(7, radius * 1.22);
  controls.maxDistance = Math.max(24, radius * 4);
  controls.autoRotate = true;
  controls.autoRotateSpeed = isHomeView ? 0.34 : 0.42;

  const graph = new THREE.Group();
  graph.rotation.set(-0.08, 0.24, 0.02);
  scene.add(graph);

  const maxScore = Math.max(1, ...connections.map((connection) => connection.score));
  connections.forEach((connection) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      positions[connection.start],
      positions[connection.end]
    ]);
    const strength = connection.score / maxScore;
    const material = new THREE.LineBasicMaterial({
      color:new THREE.Color(strength > 0.55 ? '#789487' : '#b4c1ba'),
      transparent:true,
      opacity:0.34 + strength * 0.32
    });
    graph.add(new THREE.Line(geometry, material));
  });

  const sprites = records.map((record, index) => {
    const material = new THREE.SpriteMaterial({ map:makeCardTexture(record, index), transparent:true, depthTest:true, depthWrite:true });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(positions[index]);
    sprite.scale.set(cardWidth, cardHeight, 1);
    sprite.userData = { record, baseScale:new THREE.Vector3(cardWidth, cardHeight, 1) };
    graph.add(sprite);
    return sprite;
  });

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const focus = isHomeView ? null : document.getElementById('atlas-focus');
  let hovered = null;
  let pointerDown = null;

  function hitAt(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = (event.clientX - rect.left) / rect.width * 2 - 1;
    pointer.y = -(event.clientY - rect.top) / rect.height * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(sprites, false)[0]?.object || null;
  }

  function setHovered(next) {
    if (hovered === next) return;
    if (hovered) hovered.scale.copy(hovered.userData.baseScale);
    hovered = next;
    renderer.domElement.style.cursor = hovered ? 'pointer' : 'grab';
    if (!hovered) {
      if (focus) focus.hidden = true;
      return;
    }
    hovered.scale.copy(hovered.userData.baseScale).multiplyScalar(1.12);
    const record = hovered.userData.record;
    if (focus) {
      focus.querySelector('span').textContent = record.category || '待分类';
      focus.querySelector('strong').textContent = record.title || '未命名经历';
      focus.querySelector('small').textContent = formatDate(record.date);
      focus.hidden = false;
    }
  }

  renderer.domElement.addEventListener('pointerdown', (event) => {
    pointerDown = { x:event.clientX, y:event.clientY };
    renderer.domElement.style.cursor = 'grabbing';
  });
  renderer.domElement.addEventListener('pointermove', (event) => setHovered(hitAt(event)));
  renderer.domElement.addEventListener('pointerleave', () => setHovered(null));
  renderer.domElement.addEventListener('pointerup', (event) => {
    const distance = pointerDown ? Math.hypot(event.clientX - pointerDown.x, pointerDown.y - event.clientY) : Infinity;
    const hit = hitAt(event);
    pointerDown = null;
    setHovered(hit);
    if (distance < 7 && hit) location.href = '/detail?id=' + encodeURIComponent(hit.userData.record.id);
  });

  const rotationButton = document.getElementById('atlas-rotation-toggle');
  if (rotationButton) {
    rotationButton.addEventListener('click', () => {
      controls.autoRotate = !controls.autoRotate;
      rotationButton.textContent = controls.autoRotate ? 'Ⅱ' : '▶';
      rotationButton.title = controls.autoRotate ? '暂停自动旋转' : '继续自动旋转';
      rotationButton.setAttribute('aria-label', rotationButton.title);
      rotationButton.setAttribute('aria-pressed', String(controls.autoRotate));
    });
  }
  const resetButton = document.getElementById('atlas-reset');
  if (resetButton) {
    resetButton.addEventListener('click', () => {
      camera.position.copy(cameraDirection).multiplyScalar(currentFitDistance);
      controls.target.set(0, 0, 0);
      controls.update();
    });
  }

  let hasSizedRenderer = false;
  let resizeFrame = 0;
  let pendingCameraFit = false;
  function resize(forceCameraFit = false) {
    const bounds = stage.getBoundingClientRect();
    const width = Math.round(bounds.width);
    const height = Math.round(bounds.height);
    if (width < 160 || height < 160) return;
    const shouldFitCamera = forceCameraFit || !hasSizedRenderer;
    const nextCompactViewport = width < 600;
    const previousFitDistance = currentFitDistance;
    const cameraOffset = camera.position.clone().sub(controls.target);
    const zoomRatio = previousFitDistance > 0 ? cameraOffset.length() / previousFitDistance : 1;
    camera.fov = nextCompactViewport ? 52 : 42;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    currentFitDistance = fittedDistance(width, height);
    controls.minDistance = Math.min(Math.max(7, radius * 1.22), currentFitDistance * 0.8);
    controls.maxDistance = Math.max(24, radius * 4, currentFitDistance * 2.2);
    if (!hasSizedRenderer || shouldFitCamera) {
      controls.target.set(0, 0, 0);
      camera.position.copy(cameraDirection).multiplyScalar(currentFitDistance);
    } else {
      if (cameraOffset.lengthSq() < 0.0001) cameraOffset.copy(cameraDirection);
      const nextDistance = THREE.MathUtils.clamp(
        currentFitDistance * zoomRatio,
        controls.minDistance,
        controls.maxDistance
      );
      camera.position.copy(controls.target).add(cameraOffset.normalize().multiplyScalar(nextDistance));
    }
    controls.update();
    hasSizedRenderer = true;
  }
  function scheduleResize(forceCameraFit = false) {
    pendingCameraFit = pendingCameraFit || forceCameraFit === true;
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      const shouldFitCamera = pendingCameraFit;
      pendingCameraFit = false;
      resize(shouldFitCamera);
    });
  }
  const resizeObserver = new ResizeObserver(() => {
    // The homepage content animates its width when the sidebar opens. Let the
    // browser scale the canvas during that transition and resize it once the
    // transition ends, avoiding a WebGL buffer flash on every animation frame.
    if (!isHomeView) scheduleResize();
  });
  if (!isHomeView) {
    resizeObserver.observe(stage);
    if (stage.parentElement) resizeObserver.observe(stage.parentElement);
  }
  const content = stage.closest('.content');
  if (content) {
    if (!isHomeView) resizeObserver.observe(content);
    content.addEventListener('transitionend', (event) => {
      if (event.propertyName === 'margin-left') scheduleResize();
    });
  }
  window.addEventListener('resize', () => scheduleResize());
  resize();
  if (loading) loading.hidden = true;

  function render() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }
  render();
}

async function boot() {
  if (document.fonts?.ready) await document.fonts.ready;
  initAtlas();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
else boot();
