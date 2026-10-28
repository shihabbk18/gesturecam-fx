# GestureCam FX implementation guide

## Run and verify

Use Node.js 24 or newer. From `frontend`, run:

```sh
npm ci
npm run lint
npm test
npm run build
npm run dev
```

The live app is frontend-only. No Python server, API credentials, or database is required. `backend/`, `render.yaml`, and the unused scanner components are historical AI-detector scaffolding, separate from the portal lab.

## Runtime

- `src/pages/App.jsx` owns camera acquisition, cancellation, device switching, gesture state, and pointer/keyboard controls.
- `src/lib/mediapipe.js` loads a pinned MediaPipe Hands release, shares concurrent requests, and allows retry after download errors or timeouts.
- `src/lib/scene.js` draws the camera and HUD and computes normalized pinch distances.
- `src/lib/three-portal.js` creates procedural models, renders WebGL, and animates transitions.

Camera access requires HTTPS or localhost and browser permission. Frames remain in the browser. Left-hand pinches create a portal, and right-hand pinches switch models. Mouse demo mode works without camera access.

## Deployment

The `Verify and deploy GestureCam FX` GitHub Actions workflow runs the production build, lint, and regression tests. Successful pushes to `master` or `main` publish `frontend/dist` to:

https://shihabbk18.github.io/gesturecam-fx/

GitHub Pages must use **GitHub Actions** as its build source. Pull requests verify the app without deploying. Vite's relative asset base supports deployment at a subpath.

The original `/PORTFOLIO-/gesturecam-fx/` URL is a separate compatibility deployment pinned to a tested source commit. Its revision is configured in the `shihabbk18/PORTFOLIO-` repository.

## Regression checks

Automated tests cover camera switching, permission/playback failures, late camera streams after demo entry or unmount, and failed/stalled tracker downloads. Browser checks should additionally cover WebGL rendering, mouse portal creation, model cycling, screenshots, and real two-hand tracking with camera permission.
