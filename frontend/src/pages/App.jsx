import { useEffect, useRef, useState } from "react";
import {
  Aperture,
  Camera,
  ChevronRight,
  Download,
  Code2,
  Hand,
  HelpCircle,
  Maximize2,
  MousePointer2,
  Play,
  RefreshCw,
  ScanFace,
  Sparkles,
  SwitchCamera,
  X,
} from "lucide-react";
import {
  MODEL_LIBRARY,
  drawFrame,
  handPoint,
  isPinching,
  normalizeBox,
  sizeCanvas,
} from "../lib/scene.js";

const SCRIPT_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js";
const ASSET_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/hands";

export function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const handsEngineRef = useRef(null);
  const streamRef = useRef(null);
  const frameBusyRef = useRef(false);
  const startedRef = useRef(false);
  const demoRef = useRef(false);
  const trackedHandsRef = useRef([]);
  const pointerStartRef = useRef(null);
  const swapHandsRef = useRef(true);
  const sceneRef = useRef({
    box: null,
    draft: null,
    modelIndex: 0,
    modelChangedAt: performance.now(),
  });
  const gestureRef = useRef({
    leftPinch: false,
    rightPinch: false,
    leftStart: null,
    lastRightTrigger: 0,
  });

  const [started, setStarted] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [status, setStatus] = useState("Ready to enter the gesture lab");
  const [modelIndex, setModelIndex] = useState(0);
  const [portalReady, setPortalReady] = useState(false);
  const [leftTracked, setLeftTracked] = useState(false);
  const [rightTracked, setRightTracked] = useState(false);
  const [leftPinching, setLeftPinching] = useState(false);
  const [rightPinching, setRightPinching] = useState(false);
  const [fps, setFps] = useState(0);
  const [showGuide, setShowGuide] = useState(true);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [swapHands, setSwapHands] = useState(true);

  const activeModel = MODEL_LIBRARY[modelIndex];

  useEffect(() => {
    swapHandsRef.current = swapHands;
  }, [swapHands]);

  useEffect(() => {
    refreshDevices();
  }, []);

  useEffect(() => {
    let animationFrame;
    let stopped = false;
    let frameCount = 0;
    let lastFpsTime = performance.now();

    function render(time) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dimensions = sizeCanvas(canvas);
      const context = canvas.getContext("2d");
      drawFrame(
        context,
        dimensions,
        demoRef.current ? null : videoRef.current,
        sceneRef.current,
        trackedHandsRef.current,
        time,
      );

      const video = videoRef.current;
      if (
        startedRef.current &&
        !demoRef.current &&
        video?.readyState >= 2 &&
        handsEngineRef.current &&
        !frameBusyRef.current
      ) {
        frameBusyRef.current = true;
        handsEngineRef.current
          .send({ image: video })
          .catch(() => setStatus("Hand tracking paused — try restarting the camera"))
          .finally(() => {
            frameBusyRef.current = false;
          });
      }

      frameCount += 1;
      if (time - lastFpsTime > 700) {
        setFps(Math.round((frameCount * 1000) / (time - lastFpsTime)));
        frameCount = 0;
        lastFpsTime = time;
      }

      if (!stopped) animationFrame = requestAnimationFrame(render);
    }

    animationFrame = requestAnimationFrame(render);
    return () => {
      stopped = true;
      cancelAnimationFrame(animationFrame);
      handsEngineRef.current?.close?.();
      streamRef.current?.getTracks?.().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event) {
      if (!startedRef.current) return;
      if (event.code === "Space" || event.code === "ArrowRight") {
        event.preventDefault();
        cycleModel();
      }
      if (event.key.toLowerCase() === "r") resetPortal();
      if (event.key.toLowerCase() === "f") toggleFullscreen();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  async function startCamera() {
    setStatus("Loading the two-hand AI tracker...");
    try {
      demoRef.current = false;
      setDemoMode(false);
      await loadMediaPipe();
      if (!window.Hands) throw new Error("The hand tracker could not load");

      streamRef.current?.getTracks?.().forEach((track) => track.stop());
      await handsEngineRef.current?.close?.();

      const hands = new window.Hands({ locateFile: (file) => `${ASSET_URL}/${file}` });
      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        selfieMode: false,
        minDetectionConfidence: 0.68,
        minTrackingConfidence: 0.62,
      });
      hands.onResults(handleHandResults);
      handsEngineRef.current = hands;

      setStatus("Waiting for camera permission...");
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
      resetPortal();
      setStatus("Show both hands — left draws, right changes the model");
    } catch (error) {
      startedRef.current = false;
      setStarted(false);
      setStatus(`Camera unavailable: ${error.message}`);
    }
  }

  function startDemo() {
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    demoRef.current = true;
    startedRef.current = true;
    trackedHandsRef.current = [];
    setDemoMode(true);
    setStarted(true);
    const width = window.innerWidth;
    const height = window.innerHeight;
    const box = {
      x: Math.max(24, width * 0.3),
      y: Math.max(130, height * 0.24),
      width: Math.min(width * 0.44, 620),
      height: Math.min(height * 0.5, 470),
    };
    sceneRef.current = { ...sceneRef.current, box, draft: null, modelIndex: 0, modelChangedAt: performance.now() };
    setModelIndex(0);
    setPortalReady(true);
    setStatus("Demo mode — drag a new portal or press Space to transform");
  }

  function handleHandResults(results) {
    const landmarks = results.multiHandLandmarks || [];
    const handedness = results.multiHandedness || [];
    const nextHands = landmarks.map((points, index) => {
      const rawLabel = handedness[index]?.label || "Right";
      const label = swapHandsRef.current
        ? rawLabel === "Left" ? "Right" : "Left"
        : rawLabel;
      return { label, score: handedness[index]?.score || 0, landmarks: points };
    });
    trackedHandsRef.current = nextHands;
    processHandGestures(nextHands);
  }

  function processHandGestures(hands) {
    const left = hands.find((hand) => hand.label === "Left");
    const right = hands.find((hand) => hand.label === "Right");
    setLeftTracked(Boolean(left));
    setRightTracked(Boolean(right));

    const leftIsPinching = Boolean(left && isPinching(left.landmarks));
    const rightIsPinching = Boolean(right && isPinching(right.landmarks));
    setLeftPinching(leftIsPinching);
    setRightPinching(rightIsPinching);

    const gesture = gestureRef.current;
    if (left && leftIsPinching) {
      const point = handPoint(left.landmarks[8], window.innerWidth, window.innerHeight);
      if (!gesture.leftPinch) gesture.leftStart = point;
      if (gesture.leftStart) sceneRef.current.draft = normalizeBox(gesture.leftStart, point);
    } else if (gesture.leftPinch) {
      commitDraft();
      gesture.leftStart = null;
    }
    gesture.leftPinch = leftIsPinching;

    const now = performance.now();
    if (rightIsPinching && !gesture.rightPinch && now - gesture.lastRightTrigger > 720) {
      gesture.lastRightTrigger = now;
      if (sceneRef.current.box) cycleModel();
      else setStatus("Draw the portal first: left-hand pinch, drag, and release");
    }
    gesture.rightPinch = rightIsPinching;
  }

  function commitDraft() {
    const draft = sceneRef.current.draft;
    sceneRef.current.draft = null;
    if (!draft || draft.width < 120 || draft.height < 90) {
      setStatus("Make the portal larger — drag at least 120 × 90 pixels");
      return;
    }
    const padding = 12;
    const box = {
      x: Math.max(padding, draft.x),
      y: Math.max(88, draft.y),
      width: Math.min(draft.width, window.innerWidth - draft.x - padding),
      height: Math.min(draft.height, window.innerHeight - draft.y - 92),
    };
    sceneRef.current = {
      ...sceneRef.current,
      box,
      draft: null,
      modelIndex: 0,
      modelChangedAt: performance.now(),
    };
    setModelIndex(0);
    setPortalReady(true);
    setStatus("Portal locked — pinch with your right hand to transform it");
  }

  function cycleModel() {
    if (!sceneRef.current.box) {
      setStatus("Create a portal first with your left hand or mouse");
      return;
    }
    const next = (sceneRef.current.modelIndex + 1) % MODEL_LIBRARY.length;
    sceneRef.current.modelIndex = next;
    sceneRef.current.modelChangedAt = performance.now();
    setModelIndex(next);
    setStatus(`${MODEL_LIBRARY[next].name} materialized`);
  }

  function chooseModel(index) {
    if (!sceneRef.current.box) {
      setStatus("Create a portal first with your left hand or mouse");
      return;
    }
    sceneRef.current.modelIndex = index;
    sceneRef.current.modelChangedAt = performance.now();
    setModelIndex(index);
    setStatus(`${MODEL_LIBRARY[index].name} materialized`);
  }

  function resetPortal() {
    sceneRef.current = { ...sceneRef.current, box: null, draft: null, modelIndex: 0, modelChangedAt: performance.now() };
    gestureRef.current.leftStart = null;
    setModelIndex(0);
    setPortalReady(false);
    if (startedRef.current) setStatus("Portal cleared — draw a new box with your left hand");
  }

  function onPointerDown(event) {
    if (!startedRef.current || event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    sceneRef.current.draft = { x: event.clientX, y: event.clientY, width: 0, height: 0 };
    setStatus("Drawing portal with pointer...");
  }

  function onPointerMove(event) {
    if (!pointerStartRef.current) return;
    sceneRef.current.draft = normalizeBox(pointerStartRef.current, { x: event.clientX, y: event.clientY });
  }

  function onPointerUp(event) {
    if (!pointerStartRef.current) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    pointerStartRef.current = null;
    commitDraft();
  }

  async function refreshDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const list = await navigator.mediaDevices.enumerateDevices();
    const cameras = list.filter((device) => device.kind === "videoinput");
    setDevices(cameras);
    if (!selectedDeviceId && cameras[0]?.deviceId) setSelectedDeviceId(cameras[0].deviceId);
  }

  function downloadScreenshot() {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = `gesturecam-portal-${Date.now()}.png`;
      link.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.();
  }

  return (
    <main className="gestureLab">
      <video ref={videoRef} className="hiddenVideo" playsInline muted />
      <canvas
        ref={canvasRef}
        className="stageCanvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(event) => {
          event.preventDefault();
          cycleModel();
        }}
        aria-label="Interactive camera stage. Drag to draw a portal; right-click to switch the object."
      />

      <header className="topBar">
        <a className="brand" href="https://github.com/shihabbk18/gesturecam-fx" target="_blank" rel="noreferrer">
          <span className="brandIcon"><Aperture size={19} /></span>
          <span><strong>GESTURECAM</strong><small>FX / PORTAL LAB</small></span>
        </a>
        <div className="systemStatus">
          <span className={started ? "statusDot live" : "statusDot"} />
          <p>{status}</p>
        </div>
        <div className="topMeta">
          <span>{demoMode ? "DEMO" : started ? "CAMERA" : "STANDBY"}</span>
          <span>{fps} FPS</span>
          <a href="https://github.com/shihabbk18/gesturecam-fx" target="_blank" rel="noreferrer" aria-label="Open GitHub repository"><Code2 size={18} /></a>
        </div>
      </header>

      {started && (
        <>
          <aside className="gestureGuide leftGuide">
            <div className={leftTracked ? "handBadge tracked" : "handBadge"}><Hand size={18} /><span>L</span></div>
            <div><small>LEFT HAND</small><strong>{leftPinching ? "DRAWING PORTAL" : "PINCH + DRAG"}</strong><p>Pinch thumb and index. Drag corner to corner, then release.</p></div>
          </aside>

          <aside className="gestureGuide rightGuide">
            <div className={rightTracked ? "handBadge right tracked" : "handBadge right"}><Sparkles size={18} /><span>R</span></div>
            <div><small>RIGHT HAND</small><strong>{rightPinching ? "TRANSFORMING" : "PINCH TO SWITCH"}</strong><p>One clean pinch changes the object inside your portal.</p></div>
          </aside>

          <nav className="modelDock" aria-label="Portal models">
            <div className="dockLabel"><span>ACTIVE MODEL</span><strong>{activeModel.name}</strong></div>
            <div className="modelOptions">
              {MODEL_LIBRARY.map((model, index) => (
                <button
                  type="button"
                  key={model.id}
                  className={modelIndex === index ? "active" : ""}
                  style={{ "--model-color": model.color }}
                  onClick={() => chooseModel(index)}
                  aria-label={`Show ${model.name}`}
                >
                  <span>0{index + 1}</span><i />
                </button>
              ))}
            </div>
            <button className="nextModel" type="button" onClick={cycleModel}>NEXT <ChevronRight size={16} /></button>
          </nav>

          <div className="controlDock" aria-label="Experience controls">
            {!demoMode && devices.length > 1 && (
              <label title="Select camera">
                <SwitchCamera size={17} />
                <select value={selectedDeviceId} onChange={(event) => setSelectedDeviceId(event.target.value)}>
                  {devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>)}
                </select>
              </label>
            )}
            <button type="button" onClick={downloadScreenshot} title="Download screenshot"><Download size={17} /></button>
            <button type="button" onClick={resetPortal} title="Reset portal"><RefreshCw size={17} /></button>
            <button type="button" onClick={toggleFullscreen} title="Fullscreen"><Maximize2 size={17} /></button>
            {!demoMode && <button type="button" onClick={() => setSwapHands((value) => !value)} title="Swap detected left and right hands" className={swapHands ? "active" : ""}><SwitchCamera size={17} /></button>}
            <button type="button" onClick={() => setShowGuide(true)} title="Show help"><HelpCircle size={17} /></button>
          </div>

          {!portalReady && <div className="portalPrompt"><span>01</span><p>CREATE THE PORTAL</p><strong>LEFT PINCH + DRAG</strong></div>}
        </>
      )}

      {!started && (
        <section className="launchScreen">
          <div className="launchEyebrow"><ScanFace size={17} /><span>AI HAND TRACKING / 21 LANDMARKS × 2</span></div>
          <h1>DRAW A PORTAL.<br /><em>SUMMON THE IMPOSSIBLE.</em></h1>
          <p>Use your left hand to create a box in the air. Use your right hand to transform what lives inside it.</p>
          <div className="launchActions">
            <button type="button" className="primaryAction" onClick={startCamera}><Camera size={20} /><span>START CAMERA</span><ChevronRight size={18} /></button>
            <button type="button" className="secondaryAction" onClick={startDemo}><MousePointer2 size={18} /><span>TRY MOUSE DEMO</span></button>
          </div>
          <div className="launchModels">
            {MODEL_LIBRARY.map((model, index) => <span key={model.id}><i style={{ background: model.color }} />0{index + 1} {model.short}</span>)}
          </div>
          <small className="privacyNote">CAMERA FRAMES STAY IN YOUR BROWSER · NOTHING IS UPLOADED</small>
        </section>
      )}

      {started && showGuide && (
        <section className="guideModal" role="dialog" aria-modal="true" aria-labelledby="guide-title">
          <button className="closeGuide" type="button" onClick={() => setShowGuide(false)} aria-label="Close guide"><X size={18} /></button>
          <span className="guideStep">QUICK START / 30 SECONDS</span>
          <h2 id="guide-title">YOUR HANDS ARE THE INTERFACE.</h2>
          <div className="guideSteps">
            <article><span>01</span><Hand size={24} /><strong>DRAW WITH LEFT</strong><p>Pinch thumb and index at one corner, drag diagonally, then release.</p></article>
            <article><span>02</span><Sparkles size={24} /><strong>SWITCH WITH RIGHT</strong><p>Make a fresh right-hand pinch each time you want a new creature or object.</p></article>
            <article><span>03</span><MousePointer2 size={24} /><strong>FALLBACK CONTROLS</strong><p>Drag with the mouse to draw. Right-click or press Space to transform. Press R to reset.</p></article>
          </div>
          <button className="enterLab" type="button" onClick={() => setShowGuide(false)}>ENTER THE LAB <ChevronRight size={17} /></button>
        </section>
      )}
    </main>
  );
}

async function loadMediaPipe() {
  const existing = document.querySelector(`script[src="${SCRIPT_URL}"]`);
  if (existing) {
    if (window.Hands) return;
    await new Promise((resolve, reject) => {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
    });
    return;
  }
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.crossOrigin = "anonymous";
    script.onload = resolve;
    script.onerror = () => reject(new Error("MediaPipe could not load. Check your connection."));
    document.head.appendChild(script);
  });
}
