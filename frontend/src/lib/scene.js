export const MODEL_LIBRARY = [
  { id: "butterfly", name: "Prism Butterfly", short: "BUTTERFLY", color: "#70ffd4" },
  { id: "spider", name: "Cyber Spider", short: "SPIDER", color: "#ff6b52" },
  { id: "car", name: "Neon Roadster", short: "NEON CAR", color: "#a679ff" },
  { id: "flower", name: "Solar Bloom", short: "FLOWER", color: "#ffd760" },
  { id: "planet", name: "Orbit Planet", short: "PLANET", color: "#59bdff" },
  { id: "rocket", name: "Nova Rocket", short: "ROCKET", color: "#ff8a5c" },
  { id: "jellyfish", name: "Aqua Jelly", short: "JELLYFISH", color: "#59f3ff" },
  { id: "robot", name: "Metro Bot", short: "ROBOT", color: "#b6ff67" },
  { id: "crystal", name: "Void Crystal", short: "CRYSTAL", color: "#d879ff" },
  { id: "ufo", name: "Pulse Saucer", short: "UFO", color: "#78a7ff" },
];

export function sizeCanvas(canvas) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.round(width * ratio);
  const pixelHeight = Math.round(height * ratio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { width, height, ratio };
}

export function handPoint(landmark, width, height) {
  return { x: (1 - landmark.x) * width, y: landmark.y * height };
}

export function normalizedPinch(landmarks) {
  const pinch = distance(landmarks[4], landmarks[8]);
  const palm = Math.max(distance(landmarks[0], landmarks[9]), 0.001);
  return pinch / palm;
}

export function isPinching(landmarks) {
  return normalizedPinch(landmarks) < 0.42;
}

export function normalizeBox(start, end) {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

export function drawFrame(context, dimensions, video, scene, hands, time) {
  const { width, height } = dimensions;
  context.save();
  context.setTransform(dimensions.ratio, 0, 0, dimensions.ratio, 0, 0);
  context.clearRect(0, 0, width, height);

  if (video?.readyState >= 2 && video.videoWidth) {
    const rect = coverRect(video.videoWidth, video.videoHeight, width, height);
    context.save();
    context.translate(width, 0);
    context.scale(-1, 1);
    context.filter = "saturate(.7) contrast(1.08) brightness(.78)";
    context.drawImage(video, rect.x, rect.y, rect.width, rect.height);
    context.restore();
    drawCameraGrade(context, width, height);
  } else {
    drawDemoBackground(context, width, height, time);
  }

  drawScanner(context, width, height, time, Boolean(hands.length));
  if (scene.draft) drawDraftBox(context, scene.draft, time);
  if (scene.box) drawPortal(context, scene, time);
  hands.forEach((hand) => drawHand(context, hand, width, height, time));
  context.restore();
}

function coverRect(sourceWidth, sourceHeight, targetWidth, targetHeight) {
  const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return { x: (targetWidth - width) / 2, y: (targetHeight - height) / 2, width, height };
}

function drawCameraGrade(context, width, height) {
  const wash = context.createLinearGradient(0, 0, width, height);
  wash.addColorStop(0, "rgba(1, 9, 13, .26)");
  wash.addColorStop(0.5, "rgba(5, 7, 12, .04)");
  wash.addColorStop(1, "rgba(8, 2, 15, .34)");
  context.fillStyle = wash;
  context.fillRect(0, 0, width, height);

  const vignette = context.createRadialGradient(width / 2, height / 2, width * 0.16, width / 2, height / 2, width * 0.72);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,.58)");
  context.fillStyle = vignette;
  context.fillRect(0, 0, width, height);
}

function drawDemoBackground(context, width, height, time) {
  const gradient = context.createRadialGradient(width * 0.5, height * 0.45, 20, width * 0.5, height * 0.45, width * 0.75);
  gradient.addColorStop(0, "#102a31");
  gradient.addColorStop(0.43, "#081116");
  gradient.addColorStop(1, "#020506");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.strokeStyle = "rgba(112, 255, 212, .07)";
  context.lineWidth = 1;
  const grid = 56;
  const offset = (time * 0.008) % grid;
  for (let x = -grid + offset; x < width + grid; x += grid) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = -grid + offset; y < height + grid; y += grid) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }

  for (let index = 0; index < 38; index += 1) {
    const x = (index * 97 + time * (0.004 + (index % 4) * 0.001)) % width;
    const y = (index * 61) % height;
    context.fillStyle = index % 3 ? "rgba(112,255,212,.18)" : "rgba(166,121,255,.2)";
    context.fillRect(x, y, 1.5, 1.5);
  }
}

function drawScanner(context, width, height, time, tracking) {
  context.save();
  context.globalAlpha = tracking ? 0.28 : 0.12;
  context.strokeStyle = "#70ffd4";
  context.lineWidth = 1;
  const y = (time * 0.05) % height;
  context.beginPath();
  context.moveTo(0, y);
  context.lineTo(width, y);
  context.stroke();
  const fade = context.createLinearGradient(0, y - 45, 0, y);
  fade.addColorStop(0, "rgba(112,255,212,0)");
  fade.addColorStop(1, "rgba(112,255,212,.12)");
  context.fillStyle = fade;
  context.fillRect(0, y - 45, width, 45);
  context.restore();
}

function drawDraftBox(context, box, time) {
  context.save();
  context.strokeStyle = "rgba(255,255,255,.85)";
  context.setLineDash([8, 7]);
  context.lineDashOffset = -time * 0.03;
  context.lineWidth = 1.5;
  context.strokeRect(box.x, box.y, box.width, box.height);
  context.setLineDash([]);
  drawCorners(context, box, "#70ffd4", 18, 3);
  context.fillStyle = "rgba(4, 12, 15, .72)";
  context.fillRect(box.x, Math.max(0, box.y - 27), 148, 22);
  context.fillStyle = "#b9fff0";
  context.font = "600 10px 'IBM Plex Mono', monospace";
  context.fillText(`${Math.round(box.width)} × ${Math.round(box.height)} / DRAWING`, box.x + 8, Math.max(14, box.y - 12));
  context.restore();
}

function drawPortal(context, scene, time) {
  const box = scene.box;
  const model = MODEL_LIBRARY[scene.modelIndex % MODEL_LIBRARY.length];
  const color = model.color;
  const pulse = Math.sin(time * 0.004) * 0.5 + 0.5;

  context.save();
  context.shadowColor = color;
  context.shadowBlur = 14 + pulse * 12;
  context.strokeStyle = withAlpha(color, 0.82);
  context.lineWidth = 1.5;
  context.strokeRect(box.x, box.y, box.width, box.height);
  context.shadowBlur = 0;

  context.save();
  context.beginPath();
  context.rect(box.x + 2, box.y + 2, Math.max(0, box.width - 4), Math.max(0, box.height - 4));
  context.clip();
  const interior = context.createRadialGradient(
    box.x + box.width / 2,
    box.y + box.height / 2,
    8,
    box.x + box.width / 2,
    box.y + box.height / 2,
    Math.max(box.width, box.height) * 0.7,
  );
  interior.addColorStop(0, withAlpha(color, 0.2));
  interior.addColorStop(0.55, "rgba(3,7,10,.32)");
  interior.addColorStop(1, "rgba(0,0,0,.72)");
  context.fillStyle = interior;
  context.fillRect(box.x, box.y, box.width, box.height);
  drawPortalGrid(context, box, color, time);
  context.restore();

  drawCorners(context, box, color, Math.min(26, Math.min(box.width, box.height) * 0.13), 4);
  drawPortalLabel(context, box, model, scene.modelIndex);
  context.restore();
}

function drawPortalGrid(context, box, color, time) {
  context.save();
  context.strokeStyle = withAlpha(color, 0.08);
  context.lineWidth = 1;
  const step = Math.max(24, Math.min(box.width, box.height) / 7);
  const offset = (time * 0.012) % step;
  for (let x = box.x - step + offset; x < box.x + box.width + step; x += step) {
    context.beginPath();
    context.moveTo(x, box.y);
    context.lineTo(x, box.y + box.height);
    context.stroke();
  }
  for (let y = box.y - step + offset; y < box.y + box.height + step; y += step) {
    context.beginPath();
    context.moveTo(box.x, y);
    context.lineTo(box.x + box.width, y);
    context.stroke();
  }
  context.restore();
}

function drawPortalLabel(context, box, model, index) {
  const labelWidth = Math.min(220, Math.max(142, box.width * 0.52));
  const y = box.y + box.height - 31;
  context.fillStyle = "rgba(2, 7, 9, .82)";
  context.fillRect(box.x + 9, y, labelWidth, 22);
  context.fillStyle = model.color;
  context.font = "600 10px 'IBM Plex Mono', monospace";
  context.fillText(`0${index + 1} / ${model.short}`, box.x + 17, y + 15);
}

function drawCorners(context, box, color, length, lineWidth) {
  context.save();
  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  const points = [
    [box.x, box.y, 1, 1],
    [box.x + box.width, box.y, -1, 1],
    [box.x, box.y + box.height, 1, -1],
    [box.x + box.width, box.y + box.height, -1, -1],
  ];
  points.forEach(([x, y, dx, dy]) => {
    context.beginPath();
    context.moveTo(x + dx * length, y);
    context.lineTo(x, y);
    context.lineTo(x, y + dy * length);
    context.stroke();
  });
  context.restore();
}

function drawModel(context, id, box, color, time, changedAt) {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const size = Math.max(34, Math.min(box.width, box.height) * 0.48);
  const age = Math.max(0, performance.now() - (changedAt || 0));
  const appear = easeOutBack(Math.min(1, age / 520));
  context.save();
  context.translate(cx, cy);
  context.scale(appear, appear);
  if (id === "butterfly") drawButterfly(context, size, color, time);
  if (id === "spider") drawSpider(context, size, color, time);
  if (id === "car") drawCar(context, size, color, time);
  if (id === "flower") drawFlower(context, size, color, time);
  if (id === "planet") drawPlanet(context, size, color, time);
  context.restore();
}

function drawButterfly(context, size, color, time) {
  const flap = 0.42 + Math.abs(Math.sin(time * 0.009)) * 0.58;
  const hover = Math.sin(time * 0.003) * size * 0.06;
  context.translate(0, hover);
  context.shadowColor = color;
  context.shadowBlur = size * 0.22;
  [-1, 1].forEach((direction) => {
    context.save();
    context.scale(direction * flap, 1);
    const wing = context.createLinearGradient(0, -size * 0.45, size * 0.6, size * 0.3);
    wing.addColorStop(0, withAlpha(color, 0.96));
    wing.addColorStop(0.48, "rgba(166,121,255,.9)");
    wing.addColorStop(1, "rgba(255,85,190,.32)");
    context.fillStyle = wing;
    context.beginPath();
    context.moveTo(0, -size * 0.05);
    context.bezierCurveTo(size * 0.15, -size * 0.7, size * 0.74, -size * 0.57, size * 0.54, -size * 0.02);
    context.bezierCurveTo(size * 0.9, size * 0.25, size * 0.43, size * 0.58, 0, size * 0.16);
    context.closePath();
    context.fill();
    context.restore();
  });
  context.shadowBlur = size * 0.08;
  context.fillStyle = "#ebfff9";
  roundedRect(context, -size * 0.045, -size * 0.42, size * 0.09, size * 0.72, size * 0.05);
  context.fill();
  context.strokeStyle = withAlpha(color, 0.9);
  context.lineWidth = Math.max(1, size * 0.014);
  context.beginPath();
  context.moveTo(-size * 0.02, -size * 0.38);
  context.quadraticCurveTo(-size * 0.25, -size * 0.58, -size * 0.31, -size * 0.65);
  context.moveTo(size * 0.02, -size * 0.38);
  context.quadraticCurveTo(size * 0.25, -size * 0.58, size * 0.31, -size * 0.65);
  context.stroke();
}

function drawSpider(context, size, color, time) {
  const crawl = Math.sin(time * 0.004) * size * 0.05;
  context.translate(crawl, Math.sin(time * 0.009) * size * 0.025);
  context.strokeStyle = color;
  context.lineWidth = Math.max(2, size * 0.035);
  context.lineCap = "round";
  context.shadowColor = color;
  context.shadowBlur = size * 0.18;
  for (let side = -1; side <= 1; side += 2) {
    for (let leg = 0; leg < 4; leg += 1) {
      const y = (leg - 1.5) * size * 0.13;
      const phase = Math.sin(time * 0.008 + leg * 1.4) * size * 0.07;
      context.beginPath();
      context.moveTo(side * size * 0.13, y);
      context.lineTo(side * size * 0.42, y - size * 0.12 + phase);
      context.lineTo(side * size * 0.66, y + size * 0.13 - phase);
      context.stroke();
    }
  }
  const body = context.createRadialGradient(-size * 0.1, -size * 0.16, 2, 0, 0, size * 0.4);
  body.addColorStop(0, "#fff0ed");
  body.addColorStop(0.23, color);
  body.addColorStop(1, "#2c0707");
  context.fillStyle = body;
  context.beginPath();
  context.ellipse(0, size * 0.07, size * 0.27, size * 0.35, 0, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.arc(0, -size * 0.27, size * 0.2, 0, Math.PI * 2);
  context.fill();
  context.shadowBlur = size * 0.1;
  context.fillStyle = "#f5fffc";
  for (let eye = -1; eye <= 1; eye += 2) {
    context.beginPath();
    context.arc(eye * size * 0.065, -size * 0.3, size * 0.027, 0, Math.PI * 2);
    context.fill();
  }
}

function drawCar(context, size, color, time) {
  const bob = Math.sin(time * 0.006) * size * 0.025;
  context.translate(0, bob);
  context.shadowColor = color;
  context.shadowBlur = size * 0.18;
  const body = context.createLinearGradient(-size * 0.6, 0, size * 0.6, 0);
  body.addColorStop(0, "#35145e");
  body.addColorStop(0.5, color);
  body.addColorStop(1, "#df63ff");
  context.fillStyle = body;
  context.beginPath();
  context.moveTo(-size * 0.64, size * 0.15);
  context.lineTo(-size * 0.48, -size * 0.08);
  context.lineTo(-size * 0.2, -size * 0.15);
  context.lineTo(-size * 0.02, -size * 0.42);
  context.lineTo(size * 0.32, -size * 0.42);
  context.lineTo(size * 0.48, -size * 0.12);
  context.lineTo(size * 0.64, -size * 0.02);
  context.lineTo(size * 0.62, size * 0.23);
  context.lineTo(-size * 0.6, size * 0.23);
  context.closePath();
  context.fill();
  context.fillStyle = "rgba(5,12,26,.88)";
  context.beginPath();
  context.moveTo(-size * 0.01, -size * 0.36);
  context.lineTo(size * 0.28, -size * 0.36);
  context.lineTo(size * 0.39, -size * 0.13);
  context.lineTo(-size * 0.13, -size * 0.13);
  context.closePath();
  context.fill();
  [-1, 1].forEach((direction) => {
    context.save();
    context.translate(direction * size * 0.4, size * 0.22);
    context.rotate(time * 0.004 * direction);
    context.fillStyle = "#050608";
    context.beginPath();
    context.arc(0, 0, size * 0.14, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#d9fff7";
    context.lineWidth = size * 0.025;
    context.stroke();
    context.restore();
  });
  context.globalAlpha = 0.55;
  context.fillStyle = color;
  context.fillRect(-size * 0.9, size * 0.3, size * 1.8, size * 0.025);
}

function drawFlower(context, size, color, time) {
  const bloom = 0.82 + Math.sin(time * 0.003) * 0.08;
  context.strokeStyle = "#70ffd4";
  context.lineWidth = Math.max(2, size * 0.025);
  context.shadowColor = color;
  context.shadowBlur = size * 0.16;
  context.beginPath();
  context.moveTo(0, size * 0.62);
  context.bezierCurveTo(size * 0.05, size * 0.28, -size * 0.07, size * 0.12, 0, -size * 0.03);
  context.stroke();
  context.fillStyle = "rgba(112,255,212,.75)";
  context.beginPath();
  context.ellipse(-size * 0.15, size * 0.34, size * 0.22, size * 0.09, -0.55, 0, Math.PI * 2);
  context.fill();
  context.save();
  context.translate(0, -size * 0.2);
  context.rotate(time * 0.0004);
  for (let petal = 0; petal < 9; petal += 1) {
    context.save();
    context.rotate((Math.PI * 2 * petal) / 9);
    const gradient = context.createLinearGradient(0, 0, 0, -size * 0.48);
    gradient.addColorStop(0, "#fff4b3");
    gradient.addColorStop(0.45, color);
    gradient.addColorStop(1, "rgba(255,113,74,.62)");
    context.fillStyle = gradient;
    context.beginPath();
    context.ellipse(0, -size * 0.27 * bloom, size * 0.115 * bloom, size * 0.29 * bloom, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
  const center = context.createRadialGradient(-size * 0.05, -size * 0.05, 2, 0, 0, size * 0.2);
  center.addColorStop(0, "#fffbd9");
  center.addColorStop(0.4, "#ffd760");
  center.addColorStop(1, "#c25c00");
  context.fillStyle = center;
  context.beginPath();
  context.arc(0, 0, size * 0.16, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawPlanet(context, size, color, time) {
  context.rotate(-0.22);
  context.shadowColor = color;
  context.shadowBlur = size * 0.24;
  context.strokeStyle = withAlpha(color, 0.8);
  context.lineWidth = Math.max(2, size * 0.035);
  context.beginPath();
  context.ellipse(0, 0, size * 0.72, size * 0.22, 0, 0, Math.PI * 2);
  context.stroke();
  const planet = context.createRadialGradient(-size * 0.16, -size * 0.18, size * 0.04, 0, 0, size * 0.46);
  planet.addColorStop(0, "#dfffff");
  planet.addColorStop(0.28, color);
  planet.addColorStop(0.72, "#2a3b89");
  planet.addColorStop(1, "#080d28");
  context.fillStyle = planet;
  context.beginPath();
  context.arc(0, 0, size * 0.38, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "rgba(255,255,255,.18)";
  context.lineWidth = 1;
  for (let band = -1; band <= 1; band += 1) {
    context.beginPath();
    context.ellipse(0, band * size * 0.1, size * 0.34, size * 0.08, 0, 0, Math.PI * 2);
    context.stroke();
  }
  context.rotate(time * 0.001);
  context.fillStyle = "#fff3ad";
  context.shadowColor = "#fff3ad";
  context.shadowBlur = size * 0.12;
  context.beginPath();
  context.arc(size * 0.72, 0, size * 0.045, 0, Math.PI * 2);
  context.fill();
}

function drawEnergyParticles(context, box, color, time, changedAt) {
  const age = Math.max(0, performance.now() - (changedAt || 0));
  const burst = Math.max(0, 1 - age / 650);
  const count = 24;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  for (let index = 0; index < count; index += 1) {
    const angle = index * 2.399 + time * 0.0004;
    const base = Math.min(box.width, box.height) * (0.22 + (index % 7) * 0.035);
    const radius = base * (1 + burst * 1.9);
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    context.fillStyle = withAlpha(index % 3 ? color : "#ffffff", 0.22 + burst * 0.55);
    context.fillRect(x, y, 1.5 + burst * 2.5, 1.5 + burst * 2.5);
  }
}

function drawHand(context, hand, width, height, time) {
  const points = hand.landmarks.map((landmark) => handPoint(landmark, width, height));
  const connections = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
  ];
  const color = hand.label === "Left" ? "#70ffd4" : "#a679ff";
  context.save();
  context.strokeStyle = withAlpha(color, 0.52);
  context.lineWidth = 1.5;
  connections.forEach(([a, b]) => {
    context.beginPath();
    context.moveTo(points[a].x, points[a].y);
    context.lineTo(points[b].x, points[b].y);
    context.stroke();
  });
  points.forEach((point, index) => {
    const isTip = [4, 8, 12, 16, 20].includes(index);
    context.fillStyle = isTip ? "#ffffff" : withAlpha(color, 0.9);
    context.shadowColor = color;
    context.shadowBlur = isTip ? 13 : 5;
    context.beginPath();
    context.arc(point.x, point.y, isTip ? 4.2 : 2.4, 0, Math.PI * 2);
    context.fill();
  });
  const tip = points[8];
  const pinch = isPinching(hand.landmarks);
  context.strokeStyle = color;
  context.lineWidth = 1.5;
  context.setLineDash(pinch ? [] : [4, 4]);
  context.beginPath();
  context.arc(tip.x, tip.y, 15 + Math.sin(time * 0.01) * 2, 0, Math.PI * 2);
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = "rgba(3,7,9,.72)";
  context.fillRect(tip.x + 18, tip.y - 12, 72, 20);
  context.fillStyle = color;
  context.font = "600 9px 'IBM Plex Mono', monospace";
  context.fillText(`${hand.label.toUpperCase()} / ${pinch ? "PINCH" : "TRACK"}`, tip.x + 23, tip.y + 2);
  context.restore();
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
}

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function withAlpha(hex, alpha) {
  if (!hex.startsWith("#") || (hex.length !== 7 && hex.length !== 4)) return hex;
  const expanded = hex.length === 4
    ? hex.slice(1).split("").map((value) => value + value).join("")
    : hex.slice(1);
  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function easeOutBack(value) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(value - 1, 3) + c1 * Math.pow(value - 1, 2);
}
