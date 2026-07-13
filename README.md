# GestureCam FX — AI Portal Lab

GestureCam FX is a real-time augmented-reality hand-gesture experience. Pinch with your left hand and drag through the air to draw a portal. Each new right-hand pinch transforms the animated model inside it.

![GestureCam FX AI Portal Lab](docs/gesturecam-portal.png)

**[Launch the live experience](https://shihabbk18.github.io/gesturecam-fx/)**

## The experience

1. Start the camera and allow browser camera access.
2. Hold your left thumb and index finger together.
3. Drag diagonally from one corner to the opposite corner, then release.
4. Pinch once with your right hand to cycle the model.

The model sequence is:

- Prism Butterfly
- Cyber Spider
- Neon Roadster
- Solar Bloom
- Orbit Planet

## Features

- Two-hand tracking with 21 MediaPipe landmarks per hand
- Normalized pinch detection that adapts to hand distance
- Left-hand air drawing and right-hand transformation gestures
- Five original, procedurally animated canvas models
- Neon portal effects, particles, scanner, and hand skeleton overlays
- Camera selector, screenshot capture, fullscreen, and hand-label swap
- Mouse and keyboard fallbacks for visitors without camera access
- Responsive HUD for desktop and mobile
- Camera frames remain inside the browser and are never uploaded

## Fallback controls

| Control | Action |
| --- | --- |
| Mouse/touch drag | Draw a portal |
| Right-click | Show the next model |
| Space / Right Arrow | Show the next model |
| R | Clear the portal |
| F | Toggle fullscreen |

## Run locally

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, click **Start camera**, and grant camera access. Chrome or Edge is recommended for the smoothest webcam experience.

## Build

```powershell
cd frontend
npm run build
```

The production site is generated in `frontend/dist`. The included GitHub Actions workflow verifies every production build, while the live demo is served from the portfolio site.

## Tech stack

- React + Vite
- MediaPipe Hands
- Canvas 2D procedural animation
- Lucide React icons
- GitHub Pages

## Architecture

The live experience is frontend-only. `App.jsx` manages camera access, gesture state, pointer controls, and the HUD. `scene.js` handles hand math, portal rendering, particles, and all animated model drawing. The older FastAPI scaffold remains in the repository as historical project context but is not needed by the portal lab.
