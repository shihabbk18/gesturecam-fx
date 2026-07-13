import * as THREE from "three";
import { MODEL_LIBRARY } from "./scene.js";

const PARTICLE_COUNT = 1400;

export function createThreePortal(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0.05, 6.4);

  const clippingPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 3);
  const modelRoot = new THREE.Group();
  scene.add(modelRoot);

  const ambient = new THREE.HemisphereLight(0xd9fff8, 0x1c0633, 2.2);
  scene.add(ambient);
  const key = new THREE.PointLight(0x70ffd4, 28, 18, 1.8);
  key.position.set(-3.4, 3.1, 4.5);
  scene.add(key);
  const rim = new THREE.PointLight(0xa679ff, 34, 18, 1.8);
  rim.position.set(3.6, -1.5, 3.2);
  scene.add(rim);
  const warm = new THREE.PointLight(0xff6b52, 20, 14, 2);
  warm.position.set(0, 2.8, -2.2);
  scene.add(warm);

  const dust = createDust();
  dust.points.visible = false;
  scene.add(dust.points);

  let currentIndex = -1;
  let currentModel = null;
  let transition = null;
  let queuedIndex = null;
  let lastWidth = 0;
  let lastHeight = 0;

  function material(color, options = {}) {
    return new THREE.MeshPhysicalMaterial({
      color,
      emissive: new THREE.Color(color).multiplyScalar(options.emissive ?? 0.16),
      emissiveIntensity: 1,
      metalness: options.metalness ?? 0.48,
      roughness: options.roughness ?? 0.24,
      clearcoat: options.clearcoat ?? 0.72,
      clearcoatRoughness: 0.16,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      clippingPlanes: [clippingPlane],
    });
  }

  function loadModel(index) {
    disposeGroup(modelRoot);
    const id = MODEL_LIBRARY[index].id;
    if (id === "butterfly") currentModel = buildButterfly(material);
    if (id === "spider") currentModel = buildSpider(material);
    if (id === "car") currentModel = buildCar(material);
    if (id === "flower") currentModel = buildFlower(material);
    if (id === "planet") currentModel = buildPlanet(material);
    if (id === "rocket") currentModel = buildRocket(material);
    if (id === "jellyfish") currentModel = buildJellyfish(material);
    if (id === "robot") currentModel = buildRobot(material);
    if (id === "crystal") currentModel = buildCrystal(material);
    if (id === "ufo") currentModel = buildUfo(material);
    currentModel.userData.baseScale = currentModel.scale.clone();
    currentIndex = index;
    modelRoot.add(currentModel);
    modelRoot.rotation.set(0.08, -0.22, 0);
    modelRoot.position.set(0, 0, 0);
    modelRoot.scale.setScalar(1);
    currentModel.position.set(0, 0, 0);
    setOpacity(modelRoot, 1);
    dust.material.color.set(MODEL_LIBRARY[index].color);
    resetDust(dust);
  }

  function setModel(index, immediate = false) {
    if (index === currentIndex && currentModel) return;
    if (immediate || currentIndex < 0) {
      transition = null;
      clippingPlane.constant = 3;
      loadModel(index);
      return;
    }
    if (transition) {
      queuedIndex = index;
      return;
    }
    transition = { phase: "out", startedAt: performance.now(), target: index };
    resetDust(dust);
    dust.material.color.set(MODEL_LIBRARY[currentIndex].color);
    dust.points.visible = true;
  }

  function updateTransition(now) {
    if (!transition) {
      clippingPlane.constant = 3;
      setOpacity(modelRoot, 1);
      dust.points.visible = false;
      return;
    }

    if (transition.phase === "out") {
      const progress = Math.min(1, (now - transition.startedAt) / 1050);
      const eased = easeInOut(progress);
      clippingPlane.constant = 2.6 - eased * 5.2;
      setOpacity(modelRoot, 1 - eased * 0.25);
      applyExitMotion(currentModel, eased, now * 0.001);
      updateDust(dust, eased, 1);
      if (progress >= 1) {
        loadModel(transition.target);
        clippingPlane.constant = -2.6;
        transition = { phase: "in", startedAt: now, target: transition.target };
        resetDust(dust);
        dust.points.visible = true;
      }
      return;
    }

    const progress = Math.min(1, (now - transition.startedAt) / 520);
    const eased = easeOut(progress);
    clippingPlane.constant = -2.6 + eased * 5.2;
    setOpacity(modelRoot, 0.72 + eased * 0.28);
    updateDust(dust, 1 - eased, -1);
    if (progress >= 1) {
      transition = null;
      clippingPlane.constant = 3;
      setOpacity(modelRoot, 1);
      dust.points.visible = false;
      if (queuedIndex !== null && queuedIndex !== currentIndex) {
        const nextIndex = queuedIndex;
        queuedIndex = null;
        setModel(nextIndex);
      } else {
        queuedIndex = null;
      }
    }
  }

  function render({ box, modelIndex, time, width, height }) {
    if (width !== lastWidth || height !== lastHeight) {
      renderer.setSize(width, height, false);
      lastWidth = width;
      lastHeight = height;
    }
    renderer.setScissorTest(false);
    renderer.clear();
    if (!box || box.width < 20 || box.height < 20) return;
    if (currentIndex < 0) setModel(modelIndex, true);
    if (modelIndex !== currentIndex && !transition) setModel(modelIndex);

    animateModel(currentModel, time * 0.001);
    updateTransition(performance.now());
    modelRoot.rotation.y = Math.sin(time * 0.00055) * 0.2;
    modelRoot.position.y = Math.sin(time * 0.0018) * 0.08;

    const safeBox = {
      x: Math.max(0, box.x + 4),
      y: Math.max(0, box.y + 4),
      width: Math.max(1, Math.min(box.width - 8, width - box.x - 4)),
      height: Math.max(1, Math.min(box.height - 8, height - box.y - 4)),
    };
    camera.aspect = safeBox.width / safeBox.height;
    camera.updateProjectionMatrix();
    renderer.setViewport(safeBox.x, height - safeBox.y - safeBox.height, safeBox.width, safeBox.height);
    renderer.setScissor(safeBox.x, height - safeBox.y - safeBox.height, safeBox.width, safeBox.height);
    renderer.setScissorTest(true);
    renderer.render(scene, camera);
    renderer.setScissorTest(false);
  }

  function reset() {
    transition = null;
    queuedIndex = null;
    dust.points.visible = false;
    clippingPlane.constant = 3;
  }

  function dispose() {
    disposeGroup(modelRoot);
    dust.geometry.dispose();
    dust.material.dispose();
    renderer.dispose();
  }

  return { render, setModel, reset, dispose };
}

function buildButterfly(makeMaterial) {
  const group = new THREE.Group();
  const bodyMaterial = makeMaterial(0x182c36, { metalness: 0.72, roughness: 0.16 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.86, 8, 16), bodyMaterial);
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 16), makeMaterial(0x70ffd4, { emissive: 0.4 }));
  head.position.y = 0.63;
  group.add(head);

  const wingMaterial = makeMaterial(0x7f63ff, { metalness: 0.18, roughness: 0.12, emissive: 0.32 });
  wingMaterial.transmission = 0.12;
  const wings = [];
  [-1, 1].forEach((side) => {
    const wingRoot = new THREE.Group();
    wingRoot.position.x = side * 0.08;
    const upper = new THREE.Mesh(new THREE.SphereGeometry(0.72, 32, 22), wingMaterial.clone());
    upper.scale.set(0.92, 1.18, 0.085);
    upper.position.set(side * 0.62, 0.26, 0);
    upper.rotation.z = side * -0.42;
    wingRoot.add(upper);
    const lower = new THREE.Mesh(new THREE.SphereGeometry(0.56, 28, 18), makeMaterial(0xff5fbd, { metalness: 0.2, roughness: 0.18, emissive: 0.28 }));
    lower.scale.set(0.92, 1.05, 0.08);
    lower.position.set(side * 0.53, -0.38, 0.02);
    lower.rotation.z = side * 0.5;
    wingRoot.add(lower);
    group.add(wingRoot);
    wings.push(wingRoot);
  });
  group.userData = { type: "butterfly", wings };
  group.scale.setScalar(1.28);
  return group;
}

function buildSpider(makeMaterial) {
  const group = new THREE.Group();
  const shell = makeMaterial(0x8f1f18, { metalness: 0.68, roughness: 0.2, emissive: 0.25 });
  const abdomen = new THREE.Mesh(new THREE.SphereGeometry(0.48, 32, 24), shell);
  abdomen.scale.set(0.92, 1.18, 0.82);
  abdomen.position.y = -0.18;
  group.add(abdomen);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.31, 28, 20), makeMaterial(0xff6b52, { emissive: 0.32 }));
  head.position.y = 0.48;
  group.add(head);
  const legRoot = new THREE.Group();
  const legMaterial = makeMaterial(0x5c1114, { metalness: 0.78, roughness: 0.3 });
  for (let side = -1; side <= 1; side += 2) {
    for (let index = 0; index < 4; index += 1) {
      const y = 0.42 - index * 0.27;
      const knee = new THREE.Vector3(side * (0.72 + index * 0.05), y + (index < 2 ? 0.2 : -0.05), 0.02);
      const foot = new THREE.Vector3(side * (1.2 + index * 0.08), y - 0.28, 0.08);
      legRoot.add(cylinderBetween(new THREE.Vector3(side * 0.2, y, 0), knee, 0.055, legMaterial));
      legRoot.add(cylinderBetween(knee, foot, 0.045, legMaterial));
    }
  }
  group.add(legRoot);
  const eyes = makeMaterial(0xffffff, { emissive: 0.8, metalness: 0.1 });
  [-1, 1].forEach((side) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), eyes);
    eye.position.set(side * 0.11, 0.56, 0.28);
    group.add(eye);
  });
  group.userData = { type: "spider", legRoot };
  group.scale.setScalar(1.15);
  return group;
}

function buildCar(makeMaterial) {
  const group = new THREE.Group();
  const paint = makeMaterial(0x7d4fff, { metalness: 0.86, roughness: 0.13, emissive: 0.18 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.46, 0.92, 4, 2, 2), paint);
  body.position.y = -0.08;
  group.add(body);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.23, 0.82), makeMaterial(0xd45bff, { metalness: 0.75, roughness: 0.16, emissive: 0.2 }));
  hood.position.set(0.68, 0.2, 0);
  group.add(hood);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.5, 0.75), makeMaterial(0x15284d, { metalness: 0.5, roughness: 0.08, emissive: 0.08 }));
  cabin.position.set(-0.22, 0.38, 0);
  cabin.rotation.z = -0.08;
  group.add(cabin);
  const wheelMaterial = makeMaterial(0x08090d, { metalness: 0.2, roughness: 0.8 });
  const rimMaterial = makeMaterial(0x70ffd4, { metalness: 0.9, roughness: 0.1, emissive: 0.4 });
  const wheels = [];
  [-0.7, 0.7].forEach((x) => {
    [-0.5, 0.5].forEach((z) => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.16, 28), wheelMaterial);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, -0.34, z);
      group.add(wheel);
      wheels.push(wheel);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.18, 20), rimMaterial);
      rim.rotation.x = Math.PI / 2;
      rim.position.copy(wheel.position);
      group.add(rim);
    });
  });
  group.userData = { type: "car", wheels };
  group.rotation.y = -0.42;
  return group;
}

function buildFlower(makeMaterial) {
  const group = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.09, 1.55, 18), makeMaterial(0x26b67c, { metalness: 0.2, roughness: 0.36, emissive: 0.18 }));
  stem.position.y = -0.58;
  group.add(stem);
  const bloom = new THREE.Group();
  bloom.position.y = 0.32;
  for (let index = 0; index < 10; index += 1) {
    const angle = (Math.PI * 2 * index) / 10;
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.37, 24, 18), makeMaterial(index % 2 ? 0xffc850 : 0xff754e, { metalness: 0.16, roughness: 0.22, emissive: 0.28 }));
    petal.scale.set(0.58, 1.16, 0.22);
    petal.position.set(Math.cos(angle) * 0.52, Math.sin(angle) * 0.52, 0);
    petal.rotation.z = angle - Math.PI / 2;
    bloom.add(petal);
  }
  const center = new THREE.Mesh(new THREE.SphereGeometry(0.34, 28, 20), makeMaterial(0xffdc60, { metalness: 0.25, roughness: 0.18, emissive: 0.5 }));
  center.position.z = 0.18;
  bloom.add(center);
  group.add(bloom);
  group.userData = { type: "flower", bloom };
  group.scale.setScalar(1.18);
  return group;
}

function buildPlanet(makeMaterial) {
  const group = new THREE.Group();
  const planet = new THREE.Mesh(new THREE.SphereGeometry(0.9, 48, 32), makeMaterial(0x288fff, { metalness: 0.42, roughness: 0.23, emissive: 0.28 }));
  group.add(planet);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.28, 0.065, 14, 100), makeMaterial(0xffd46b, { metalness: 0.72, roughness: 0.13, emissive: 0.45 }));
  ring.rotation.x = 1.18;
  ring.rotation.y = 0.28;
  group.add(ring);
  const moonRoot = new THREE.Group();
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 12), makeMaterial(0xf8ffff, { metalness: 0.2, roughness: 0.28, emissive: 0.45 }));
  moon.position.x = 1.55;
  moonRoot.add(moon);
  group.add(moonRoot);
  group.userData = { type: "planet", planet, ring, moonRoot };
  return group;
}

function buildRocket(makeMaterial) {
  const group = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.48, 1.55, 28),
    makeMaterial(0xe8f6ff, { metalness: 0.78, roughness: 0.18, emissive: 0.12 }),
  );
  group.add(hull);
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.36, 0.72, 28),
    makeMaterial(0xff6b52, { metalness: 0.64, roughness: 0.16, emissive: 0.32 }),
  );
  nose.position.y = 1.13;
  group.add(nose);
  const windowMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 22, 16),
    makeMaterial(0x59f3ff, { metalness: 0.25, roughness: 0.08, emissive: 0.7 }),
  );
  windowMesh.scale.z = 0.34;
  windowMesh.position.set(0, 0.3, 0.34);
  group.add(windowMesh);
  [-1, 1].forEach((side) => {
    const fin = new THREE.Mesh(
      new THREE.ConeGeometry(0.24, 0.74, 3),
      makeMaterial(0x7d4fff, { metalness: 0.6, roughness: 0.18, emissive: 0.3 }),
    );
    fin.position.set(side * 0.42, -0.62, 0);
    fin.rotation.z = side * 0.2;
    group.add(fin);
  });
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.25, 0.85, 22),
    makeMaterial(0xffc44f, { metalness: 0.05, roughness: 0.18, emissive: 1 }),
  );
  flame.position.y = -1.2;
  flame.rotation.z = Math.PI;
  group.add(flame);
  group.userData = { type: "rocket", flame };
  group.scale.setScalar(0.86);
  return group;
}

function buildJellyfish(makeMaterial) {
  const group = new THREE.Group();
  const bell = new THREE.Mesh(
    new THREE.SphereGeometry(0.8, 36, 24, 0, Math.PI * 2, 0, Math.PI * 0.58),
    makeMaterial(0x59f3ff, { metalness: 0.08, roughness: 0.1, emissive: 0.48 }),
  );
  bell.scale.y = 0.82;
  bell.position.y = 0.35;
  group.add(bell);
  const tentacles = [];
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2;
    const tentacle = new THREE.Mesh(
      new THREE.TorusGeometry(0.38 + (index % 2) * 0.08, 0.035, 8, 32, Math.PI * 1.25),
      makeMaterial(index % 2 ? 0xa679ff : 0x70ffd4, { metalness: 0.12, roughness: 0.2, emissive: 0.55 }),
    );
    tentacle.rotation.set(Math.PI / 2, 0, angle);
    tentacle.position.set(Math.cos(angle) * 0.28, -0.54, Math.sin(angle) * 0.22);
    group.add(tentacle);
    tentacles.push(tentacle);
  }
  group.userData = { type: "jellyfish", bell, tentacles };
  group.scale.setScalar(1.1);
  return group;
}

function buildRobot(makeMaterial) {
  const group = new THREE.Group();
  const armor = makeMaterial(0xb6ff67, { metalness: 0.78, roughness: 0.2, emissive: 0.26 });
  const dark = makeMaterial(0x172128, { metalness: 0.62, roughness: 0.28, emissive: 0.08 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.94, 1.05, 0.55), armor);
  torso.position.y = 0.12;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.5, 0.52), dark);
  head.position.y = 0.92;
  group.add(head);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.11, 0.03), makeMaterial(0x59f3ff, { emissive: 0.95, metalness: 0.2 }));
  visor.position.set(0, 0.96, 0.275);
  group.add(visor);
  const limbs = [];
  [-1, 1].forEach((side) => {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.66, 6, 12), dark);
    arm.position.set(side * 0.62, 0.18, 0);
    group.add(arm);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.74, 6, 12), armor.clone());
    leg.position.set(side * 0.25, -0.86, 0);
    group.add(leg);
    limbs.push({ arm, leg, side });
  });
  group.userData = { type: "robot", limbs, head };
  group.scale.setScalar(0.9);
  return group;
}

function buildCrystal(makeMaterial) {
  const group = new THREE.Group();
  const shards = [];
  for (let index = 0; index < 7; index += 1) {
    const shard = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.42 + (index % 3) * 0.1, 0),
      makeMaterial(index % 2 ? 0xd879ff : 0x70ffd4, { metalness: 0.48, roughness: 0.08, emissive: 0.54 }),
    );
    const angle = (index / 7) * Math.PI * 2;
    shard.scale.y = 1.35 + (index % 3) * 0.35;
    shard.position.set(Math.cos(angle) * 0.58, (index % 2) * 0.28 - 0.15, Math.sin(angle) * 0.35);
    shard.userData.basePosition = shard.position.clone();
    shard.rotation.set(angle * 0.3, angle, angle * 0.18);
    group.add(shard);
    shards.push(shard);
  }
  group.userData = { type: "crystal", shards };
  return group;
}

function buildUfo(makeMaterial) {
  const group = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.SphereGeometry(0.95, 40, 24),
    makeMaterial(0x7d8fa7, { metalness: 0.9, roughness: 0.12, emissive: 0.12 }),
  );
  hull.scale.y = 0.25;
  group.add(hull);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.46, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2),
    makeMaterial(0x78a7ff, { metalness: 0.2, roughness: 0.05, emissive: 0.62 }),
  );
  dome.position.y = 0.02;
  group.add(dome);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.88, 0.08, 12, 64),
    makeMaterial(0x70ffd4, { metalness: 0.52, roughness: 0.1, emissive: 0.72 }),
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(0.56, 1.35, 32, 1, true),
    makeMaterial(0x70ffd4, { metalness: 0, roughness: 0.05, emissive: 0.45 }),
  );
  beam.material.opacity = 0.22;
  beam.position.y = -0.76;
  beam.rotation.z = Math.PI;
  group.add(beam);
  group.userData = { type: "ufo", ring, beam };
  group.scale.setScalar(1.12);
  return group;
}

function animateModel(model, time) {
  if (!model) return;
  const data = model.userData;
  if (data.type === "butterfly") {
    const flap = 0.18 + Math.abs(Math.sin(time * 6.8)) * 0.82;
    data.wings[0].rotation.y = -flap;
    data.wings[1].rotation.y = flap;
    model.rotation.z = Math.sin(time * 1.3) * 0.08;
  }
  if (data.type === "spider") {
    data.legRoot.rotation.z = Math.sin(time * 5.5) * 0.055;
    model.rotation.y = Math.sin(time * 0.8) * 0.28;
  }
  if (data.type === "car") {
    data.wheels.forEach((wheel) => { wheel.rotation.y = time * 3.8; });
    model.rotation.y = -0.42 + Math.sin(time * 0.7) * 0.17;
  }
  if (data.type === "flower") {
    data.bloom.rotation.z = time * 0.22;
    const pulse = 0.97 + Math.sin(time * 2) * 0.045;
    data.bloom.scale.setScalar(pulse);
  }
  if (data.type === "planet") {
    data.planet.rotation.y = time * 0.48;
    data.ring.rotation.z = time * 0.16;
    data.moonRoot.rotation.z = time * 0.8;
  }
  if (data.type === "rocket") {
    data.flame.scale.set(0.84 + Math.sin(time * 18) * 0.1, 0.88 + Math.sin(time * 25) * 0.14, 0.84);
    model.rotation.z = Math.sin(time * 1.4) * 0.04;
  }
  if (data.type === "jellyfish") {
    const pulse = 0.92 + Math.sin(time * 3.4) * 0.08;
    data.bell.scale.set(1 / pulse, 0.82 * pulse, 1 / pulse);
    data.tentacles.forEach((tentacle, index) => {
      tentacle.rotation.z = Math.sin(time * 2.8 + index) * 0.13;
    });
    model.rotation.z = Math.sin(time * 0.9) * 0.1;
  }
  if (data.type === "robot") {
    data.limbs.forEach(({ arm, leg, side }) => {
      arm.rotation.x = Math.sin(time * 3.6) * 0.36 * side;
      leg.rotation.x = -Math.sin(time * 3.6) * 0.28 * side;
    });
    data.head.rotation.y = Math.sin(time * 1.5) * 0.22;
  }
  if (data.type === "crystal") {
    data.shards.forEach((shard, index) => {
      shard.rotation.y = time * (0.22 + index * 0.035);
      shard.position.y = shard.userData.basePosition.y + Math.sin(time * 1.8 + index) * 0.025;
    });
    model.rotation.y = time * 0.18;
  }
  if (data.type === "ufo") {
    data.ring.rotation.z = time * 1.5;
    data.beam.material.opacity = 0.16 + Math.sin(time * 4.5) * 0.06;
    model.rotation.z = Math.sin(time * 1.2) * 0.06;
  }
}

function applyExitMotion(model, progress, time) {
  if (!model) return;
  const data = model.userData;
  const acceleration = progress * progress;
  const baseScale = data.baseScale || new THREE.Vector3(1, 1, 1);

  if (data.type === "butterfly") {
    model.position.set(progress * 3.7, progress * 2.6 + Math.sin(time * 13) * 0.16, -progress * 0.5);
    model.scale.copy(baseScale).multiplyScalar(1 - progress * 0.26);
    data.wings[0].rotation.y = -(0.3 + Math.abs(Math.sin(time * 18)) * 1.1);
    data.wings[1].rotation.y = 0.3 + Math.abs(Math.sin(time * 18)) * 1.1;
  }
  if (data.type === "spider") {
    model.position.set(-progress * 4.1, -progress * 0.95 + Math.sin(time * 17) * 0.05, 0);
    model.rotation.z = -progress * 0.22;
    data.legRoot.rotation.z = Math.sin(time * 20) * 0.16;
  }
  if (data.type === "car") {
    model.position.set(acceleration * 6.2, -progress * 0.18, 0);
    model.rotation.z = -progress * 0.08;
    data.wheels.forEach((wheel) => { wheel.rotation.y = time * (8 + progress * 42); });
  }
  if (data.type === "flower") {
    model.position.y = -acceleration * 2.7;
    model.rotation.z = progress * 0.72;
    model.scale.copy(baseScale).multiplyScalar(1 - progress * 0.62);
    data.bloom.rotation.z = time * (0.22 + progress * 5.5);
  }
  if (data.type === "planet") {
    model.position.z = -progress * 6;
    model.rotation.y = time * (0.48 + progress * 8);
    model.scale.copy(baseScale).multiplyScalar(Math.max(0.08, 1 - progress * 0.92));
  }
  if (data.type === "rocket") {
    model.position.set(Math.sin(progress * Math.PI * 2) * 0.18, acceleration * 6.4, 0);
    model.scale.copy(baseScale).multiplyScalar(1 - progress * 0.3);
    data.flame.scale.y = 0.9 + progress * 3.2;
  }
  if (data.type === "jellyfish") {
    model.position.set(-progress * 3.8, progress * 1.9 + Math.sin(time * 8) * 0.22, -progress);
    model.rotation.z = -progress * 0.5;
    model.scale.copy(baseScale).multiplyScalar(1 - progress * 0.35);
  }
  if (data.type === "robot") {
    model.position.set(progress * 4.2, Math.abs(Math.sin(time * 12)) * 0.14 - progress * 0.2, 0);
    model.rotation.z = -progress * 0.12;
    data.limbs.forEach(({ arm, leg, side }) => {
      arm.rotation.x = Math.sin(time * 14) * 0.65 * side;
      leg.rotation.x = -Math.sin(time * 14) * 0.55 * side;
    });
  }
  if (data.type === "crystal") {
    model.position.y = -acceleration * 3.8;
    model.rotation.y = time * (0.18 + progress * 8);
    data.shards.forEach((shard, index) => {
      const angle = (index / data.shards.length) * Math.PI * 2;
      shard.position.x = shard.userData.basePosition.x + Math.cos(angle) * progress * 1.2;
      shard.position.y = shard.userData.basePosition.y + Math.sin(angle) * progress * 1.2;
    });
  }
  if (data.type === "ufo") {
    model.position.set(acceleration * 4.9, acceleration * 4.4, -progress * 1.8);
    model.rotation.z = -progress * 0.42;
    model.scale.copy(baseScale).multiplyScalar(Math.max(0.12, 1 - progress * 0.8));
    data.ring.rotation.z = time * (1.5 + progress * 15);
  }
}

function cylinderBetween(start, end, radius, material) {
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  const direction = end.clone().sub(start);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 10), material);
  mesh.position.copy(midpoint);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  return mesh;
}

function createDust() {
  const entries = [];
  for (let index = 0; index < PARTICLE_COUNT; index += 1) {
    const x = THREE.MathUtils.randFloat(-1.35, 1.35);
    const y = THREE.MathUtils.randFloat(-1.08, 1.08);
    const z = THREE.MathUtils.randFloat(-0.48, 0.48);
    entries.push({
      x, y, z,
      velocity: new THREE.Vector3(
        THREE.MathUtils.randFloat(0.25, 1.5),
        THREE.MathUtils.randFloat(0.12, 1.25),
        THREE.MathUtils.randFloat(-0.45, 0.65),
      ),
    });
  }
  entries.sort((a, b) => a.x - b.x);
  const base = new Float32Array(PARTICLE_COUNT * 3);
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const velocity = [];
  entries.forEach((entry, index) => {
    base[index * 3] = entry.x;
    base[index * 3 + 1] = entry.y;
    base[index * 3 + 2] = entry.z;
    positions.set([entry.x, entry.y, entry.z], index * 3);
    velocity.push(entry.velocity);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setDrawRange(0, 0);
  const material = new THREE.PointsMaterial({
    color: 0x70ffd4,
    size: 0.034,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geometry, material);
  return { points, geometry, material, base, velocity };
}

function resetDust(dust) {
  const positions = dust.geometry.attributes.position.array;
  positions.set(dust.base);
  dust.geometry.attributes.position.needsUpdate = true;
  dust.geometry.setDrawRange(0, 0);
  dust.material.opacity = 0;
}

function updateDust(dust, progress, direction) {
  const positions = dust.geometry.attributes.position.array;
  const visible = Math.max(0, Math.min(PARTICLE_COUNT, Math.floor(PARTICLE_COUNT * progress)));
  for (let index = 0; index < visible; index += 1) {
    const velocity = dust.velocity[index];
    const drift = progress * (direction > 0 ? 1.4 : 0.7);
    positions[index * 3] = dust.base[index * 3] + velocity.x * drift * direction;
    positions[index * 3 + 1] = dust.base[index * 3 + 1] + velocity.y * drift;
    positions[index * 3 + 2] = dust.base[index * 3 + 2] + velocity.z * drift;
  }
  dust.geometry.attributes.position.needsUpdate = true;
  dust.geometry.setDrawRange(0, visible);
  dust.material.opacity = Math.sin(Math.min(1, progress) * Math.PI) * 0.95 + 0.05;
}

function setOpacity(group, opacity) {
  group.traverse((child) => {
    if (!child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => { material.opacity = opacity; });
  });
}

function disposeGroup(group) {
  while (group.children.length) {
    const child = group.children.pop();
    child.traverse((object) => {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
      else object.material?.dispose?.();
    });
  }
}

function easeInOut(value) {
  return value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;
}

function easeOut(value) {
  return 1 - Math.pow(1 - value, 3);
}
