import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  CircleDot,
  Download,
  Eye,
  EyeOff,
  Gauge,
  Hand,
  Maximize2,
  Play,
  ScanLine,
  SlidersHorizontal,
  Waves,
} from "lucide-react";

const filters = {
  fist: {
    label: "Fist",
    effect: "Dither",
    icon: ScanLine,
  },
  peace: {
    label: "Peace",
    effect: "VHS",
    icon: Camera,
  },
  point: {
    label: "Index",
    effect: "Spotlight",
    icon: Maximize2,
  },
  open: {
    label: "Open hand",
    effect: "Water ripple",
    icon: Waves,
  },
  none: {
    label: "No hand",
    effect: "Neutral",
    icon: Hand,
  },
};

export function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const latestRef = useRef({ landmarks: null, gesture: "none", confidence: 0 });
  const configRef = useRef({ intensity: 0.82, showDot: true });
  const handsRef = useRef(null);
  const streamRef = useRef(null);
  const frameBusyRef = useRef(false);
  const startedRef = useRef(false);
  const [status, setStatus] = useState("Click Start camera");
  const [gesture, setGesture] = useState("none");
  const [confidence, setConfidence] = useState(0);
  const [started, setStarted] = useState(false);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [intensity, setIntensity] = useState(0.82);
  const [showDot, setShowDot] = useState(true);
  const [fps, setFps] = useState(0);
  const [history, setHistory] = useState([]);
  const active = filters[gesture] || filters.none;
  const ActiveIcon = active.icon;

  useEffect(() => {
    configRef.current = { intensity, showDot };
  }, [intensity, showDot]);

  useEffect(() => {
    refreshDevices();
  }, []);

  useEffect(() => {
    let animationId;
    let stopped = false;
    let lastTime = performance.now();
    let frameCount = 0;

    function render(time) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!canvas || !video) return;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      sizeCanvas(canvas);
      drawFrame(ctx, canvas, video, latestRef.current, configRef.current, time);
      if (startedRef.current && video.readyState >= 2 && handsRef.current && !frameBusyRef.current) {
        frameBusyRef.current = true;
        handsRef.current
          .send({ image: video })
          .catch((error) => setStatus(`Tracking failed: ${error.message}`))
          .finally(() => {
            frameBusyRef.current = false;
          });
      }
      frameCount += 1;
      if (time - lastTime > 600) {
        setFps(Math.round((frameCount * 1000) / (time - lastTime)));
        frameCount = 0;
        lastTime = time;
      }
      if (!stopped) animationId = requestAnimationFrame(render);
    }

    render(0);
    return () => {
      stopped = true;
      cancelAnimationFrame(animationId);
      handsRef.current?.close();
      streamRef.current?.getTracks?.().forEach((track) => track.stop());
    };
  }, []);

  async function startCamera() {
    try {
      setStatus("Loading hand tracker...");
      await loadMediaPipeScripts();
      const Hands = window.Hands;
      if (!Hands) throw new Error("MediaPipe Hands did not load");

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (handsRef.current) {
        await handsRef.current.close();
      }

      const hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });
      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.72,
        minTrackingConfidence: 0.68,
      });
      hands.onResults((results) => {
        const landmarks = results.multiHandLandmarks?.[0] || null;
        const handedness = results.multiHandedness?.[0]?.label || "Right";
        const analysis = landmarks ? classifyGesture(landmarks, handedness) : { gesture: "none", confidence: 0 };
        const nextGesture = analysis.gesture;
        latestRef.current = { landmarks, gesture: nextGesture, confidence: analysis.confidence };
        setGesture(nextGesture);
        setConfidence(analysis.confidence);
        setStatus(landmarks ? `${filters[nextGesture].label} -> ${filters[nextGesture].effect}` : "Show one hand to the camera");
        if (landmarks && nextGesture !== "none") {
          setHistory((items) => {
            const last = items[0];
            if (last?.gesture === nextGesture && Date.now() - last.time < 1200) return items;
            return [{ gesture: nextGesture, confidence: analysis.confidence, time: Date.now() }, ...items].slice(0, 5);
          });
        }
      });
      handsRef.current = hands;

      setStatus("Requesting webcam...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
          ...(selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : {}),
        },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await new Promise((resolve) => {
        if (video.readyState >= 1) resolve();
        else video.onloadedmetadata = resolve;
      });
      await video.play();
      await refreshDevices();
      startedRef.current = true;
      setStarted(true);
      setStatus("Show one hand to the camera");
    } catch (error) {
      startedRef.current = false;
      setStarted(false);
      setStatus(`Camera failed: ${error.name || "Error"} - ${error.message}`);
    }
  }

  async function refreshDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const allDevices = await navigator.mediaDevices.enumerateDevices();
    const cameras = allDevices.filter((device) => device.kind === "videoinput");
    setDevices(cameras);
    if (!selectedDeviceId && cameras[0]?.deviceId) setSelectedDeviceId(cameras[0].deviceId);
  }

  function downloadScreenshot() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `gesturecam-fx-${Date.now()}.png`;
      link.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  }

  const gestureItems = useMemo(() => ["fist", "peace", "point", "open"], []);

  return (
    <main className="cameraApp">
      <video ref={videoRef} className="hiddenVideo" playsInline muted />
      <canvas ref={canvasRef} className="cameraCanvas" />

      <section className="hud topHud">
        <div className="brandMark">
          <Hand size={22} />
          <span>GestureCam FX</span>
        </div>
        <div className="topCluster">
          <div className="statusPill">
            <ActiveIcon size={18} />
            <span>{status}</span>
          </div>
          <div className="metricPill">
            <Gauge size={17} />
            <span>{fps} FPS</span>
          </div>
        </div>
      </section>

      <section className="hud controlPanel" aria-label="Camera controls">
        <label>
          <Camera size={17} />
          <select value={selectedDeviceId} onChange={(event) => setSelectedDeviceId(event.target.value)}>
            {devices.length === 0 && <option value="">Default camera</option>}
            {devices.map((device, index) => (
              <option value={device.deviceId} key={device.deviceId}>
                {device.label || `Camera ${index + 1}`}
              </option>
            ))}
          </select>
        </label>
        <label>
          <SlidersHorizontal size={17} />
          <input
            type="range"
            min="0.15"
            max="1"
            step="0.01"
            value={intensity}
            onChange={(event) => setIntensity(Number(event.target.value))}
          />
          <span>{Math.round(intensity * 100)}%</span>
        </label>
        <button onClick={() => setShowDot((value) => !value)} title="Toggle fingertip dot">
          {showDot ? <Eye size={17} /> : <EyeOff size={17} />}
        </button>
        <button onClick={downloadScreenshot} title="Download screenshot">
          <Download size={17} />
        </button>
        <button onClick={toggleFullscreen} title="Fullscreen">
          <Maximize2 size={17} />
        </button>
        {started && (
          <button onClick={startCamera} title="Restart selected camera">
            <Play size={17} />
          </button>
        )}
      </section>

      {!started && (
        <button className="startButton" onClick={startCamera}>
          <Play size={22} />
          <span>Start camera</span>
        </button>
      )}

      <section className="hud confidencePanel" aria-label="Gesture confidence">
        <div className="confidenceHeader">
          <CircleDot size={16} />
          <span>Confidence</span>
          <strong>{Math.round(confidence * 100)}%</strong>
        </div>
        <div className="confidenceTrack">
          <div style={{ width: `${Math.round(confidence * 100)}%` }} />
        </div>
        <div className="historyList">
          {history.length === 0 && <span>No gesture history yet</span>}
          {history.map((item) => (
            <span key={`${item.time}-${item.gesture}`}>
              {filters[item.gesture].label} {Math.round(item.confidence * 100)}%
            </span>
          ))}
        </div>
      </section>

      <section className="hud gestureDock" aria-label="Gesture filters">
        {gestureItems.map((key) => {
          const item = filters[key];
          const Icon = item.icon;
          return (
            <div className={gesture === key ? "gestureCard active" : "gestureCard"} key={key}>
              <Icon size={19} />
              <span>{item.label}</span>
              <strong>{item.effect}</strong>
            </div>
          );
        })}
      </section>
    </main>
  );
}

async function loadMediaPipeScripts() {
  await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js");
}

function loadScript(src) {
  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.crossOrigin = "anonymous";
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function classifyGesture(landmarks, handedness) {
  const fingers = getFingerStates(landmarks, handedness);
  const extended = Object.values(fingers).filter(Boolean).length;
  const wrist = landmarks[0];
  const tipSpread = distance(landmarks[8], landmarks[20]);
  const palmSize = Math.max(distance(wrist, landmarks[9]), 0.001);
  const spreadRatio = tipSpread / palmSize;

  if (extended <= 1 && !fingers.index) return { gesture: "fist", confidence: clamp(0.82 - extended * 0.12) };
  if (fingers.index && fingers.middle && !fingers.ring && !fingers.pinky) {
    return { gesture: "peace", confidence: clamp(0.68 + Math.min(spreadRatio, 1) * 0.24) };
  }
  if (fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky) {
    return { gesture: "point", confidence: clamp(0.76 + Math.min(distance(landmarks[8], landmarks[6]) * 2.2, 0.18)) };
  }
  if (extended >= 4 && fingers.index && fingers.middle && fingers.ring && fingers.pinky) {
    return { gesture: "open", confidence: clamp(0.7 + Math.min(spreadRatio, 1.1) * 0.22) };
  }
  return { gesture: "none", confidence: 0.18 };
}

function getFingerStates(lm, handedness) {
  const mirror = handedness === "Left" ? -1 : 1;
  return {
    thumb: mirror * (lm[4].x - lm[3].x) > 0.035,
    index: lm[8].y < lm[6].y - 0.025,
    middle: lm[12].y < lm[10].y - 0.025,
    ring: lm[16].y < lm[14].y - 0.02,
    pinky: lm[20].y < lm[18].y - 0.02,
  };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function sizeCanvas(canvas) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }
}

function drawFrame(ctx, canvas, video, state, config, time) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const width = canvas.width;
  const height = canvas.height;
  const hasVideo = video.readyState >= 2 && video.videoWidth > 0;
  const videoRect = coverRect(video.videoWidth || 1280, video.videoHeight || 720, width, height);

  if (hasVideo) {
    ctx.save();
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, videoRect.x, videoRect.y, videoRect.w, videoRect.h);
    ctx.restore();
  } else {
    drawIdleBackground(ctx, width, height, time);
  }

  applyFilter(ctx, width, height, state, config.intensity, time);
  if (config.showDot) drawLandmarks(ctx, width, height, state.landmarks);
}

function drawIdleBackground(ctx, width, height, time) {
  ctx.fillStyle = "#050607";
  ctx.fillRect(0, 0, width, height);
  const pulse = Math.sin(time / 500) * 0.5 + 0.5;
  const gradient = ctx.createRadialGradient(width / 2, height / 2, 20, width / 2, height / 2, width * 0.55);
  gradient.addColorStop(0, `rgba(91, 234, 205, ${0.1 + pulse * 0.08})`);
  gradient.addColorStop(1, "rgba(5, 6, 7, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function coverRect(videoWidth, videoHeight, canvasWidth, canvasHeight) {
  const scale = Math.max(canvasWidth / videoWidth, canvasHeight / videoHeight);
  const w = videoWidth * scale;
  const h = videoHeight * scale;
  return {
    x: (canvasWidth - w) / 2,
    y: (canvasHeight - h) / 2,
    w,
    h,
  };
}

function applyFilter(ctx, width, height, state, intensity, time) {
  if (state.gesture === "fist") return drawDither(ctx, width, height, intensity);
  if (state.gesture === "peace") return drawVhs(ctx, width, height, intensity, time);
  if (state.gesture === "point") return drawSpotlight(ctx, width, height, state.landmarks, intensity);
  if (state.gesture === "open") return drawWaterRipple(ctx, width, height, state.landmarks, intensity, time);
}

function drawDither(ctx, width, height, intensity) {
  const step = Math.round(7 - intensity * 4);
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  ctx.globalAlpha = intensity;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (Math.floor(y) * width + Math.floor(x)) * 4;
      const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const threshold = ((x / step + y / step) % 2) * 72 + 92;
      const value = gray > threshold ? 238 : 24;
      ctx.fillStyle = `rgb(${value}, ${value}, ${value})`;
      ctx.fillRect(x, y, step, step);
    }
  }
  ctx.globalAlpha = 1;
}

function drawVhs(ctx, width, height, intensity, time) {
  const offset = 2 + intensity * 8;
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = `rgba(255, 25, 65, ${0.08 + intensity * 0.12})`;
  ctx.drawImage(ctx.canvas, -offset, 0, width, height);
  ctx.fillStyle = `rgba(30, 190, 255, ${0.08 + intensity * 0.12})`;
  ctx.drawImage(ctx.canvas, offset, 0, width, height);
  ctx.globalCompositeOperation = "source-over";

  for (let y = 0; y < height; y += 4) {
    ctx.fillStyle = y % 8 === 0 ? `rgba(0,0,0,${0.08 + intensity * 0.15})` : "rgba(255,255,255,0.03)";
    ctx.fillRect(0, y, width, 1);
  }
  const glitchY = (Math.sin(time / 210) * 0.5 + 0.5) * height;
  ctx.fillStyle = `rgba(255,255,255,${0.08 + intensity * 0.16})`;
  ctx.fillRect(0, glitchY, width, 3 + intensity * 7);
}

function drawSpotlight(ctx, width, height, landmarks, intensity) {
  const tip = landmarks?.[8];
  const x = tip ? width - tip.x * width : width / 2;
  const y = tip ? tip.y * height : height / 2;
  const radius = 250 + (1 - intensity) * 220;
  const gradient = ctx.createRadialGradient(x, y, 60, x, y, radius);
  gradient.addColorStop(0, "rgba(255,255,255,0)");
  gradient.addColorStop(0.46, `rgba(0,0,0,${0.04 + intensity * 0.08})`);
  gradient.addColorStop(1, `rgba(0,0,0,${0.35 + intensity * 0.55})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawWaterRipple(ctx, width, height, landmarks, intensity, time) {
  const palm = landmarks?.[9];
  const cx = palm ? width - palm.x * width : width / 2;
  const cy = palm ? palm.y * height : height / 2;
  ctx.strokeStyle = `rgba(175, 235, 255, ${0.25 + intensity * 0.45})`;
  ctx.lineWidth = 1 + intensity * 3;
  for (let i = 0; i < 4 + Math.round(intensity * 5); i += 1) {
    const radius = ((time / 18 + i * 46) % 320) + 20;
    ctx.globalAlpha = 1 - radius / 360;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = `rgba(35, 170, 210, ${0.04 + intensity * 0.13})`;
  ctx.fillRect(0, 0, width, height);
}

function drawLandmarks(ctx, width, height, landmarks) {
  if (!landmarks) return;
  const tip = landmarks[8];
  const x = width - tip.x * width;
  const y = tip.y * height;

  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.shadowColor = "rgba(255,255,255,0.9)";
  ctx.shadowBlur = 22;
  ctx.beginPath();
  ctx.arc(x, y, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = "rgba(255,255,255,0.46)";
  ctx.lineWidth = 2;
  [5, 6, 7, 8].forEach((index, i, arr) => {
    if (i === 0) return;
    const a = landmarks[arr[i - 1]];
    const b = landmarks[index];
    ctx.beginPath();
    ctx.moveTo(width - a.x * width, a.y * height);
    ctx.lineTo(width - b.x * width, b.y * height);
    ctx.stroke();
  });
}
