const ASSET_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240";
let loading;

export { ASSET_URL };

export function loadMediaPipe() {
  if (window.Hands) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timeout = setTimeout(() => fail(), 30000);
    function fail() {
      clearTimeout(timeout);
      script.remove();
      reject(new Error("MediaPipe could not load. Check your connection and try again."));
    }
    script.src = `${ASSET_URL}/hands.js`;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      if (!window.Hands) return fail();
      clearTimeout(timeout);
      resolve();
    };
    script.onerror = fail;
    document.head.appendChild(script);
  }).finally(() => { loading = undefined; });
  return loading;
}
