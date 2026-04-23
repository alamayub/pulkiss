/**
 * Load the YouTube IFrame API once; resolves when `YT.Player` is available.
 * @returns {Promise<void>}
 */
export function loadYouTubeIframeAPI() {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  if (window.YT && window.YT.Player) {
    return Promise.resolve();
  }
  if (window._ytApiLoadPromise) {
    return window._ytApiLoadPromise;
  }
  window._ytApiLoadPromise = new Promise((resolve) => {
    const done = () => {
      if (window.YT && window.YT.Player) {
        resolve();
      }
    };
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === "function") {
        prev();
      }
      done();
    };
    if (!window._ytApiScript) {
      window._ytApiScript = true;
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const first = document.getElementsByTagName("script")[0];
      first?.parentNode?.insertBefore(tag, first);
    }
  });
  return window._ytApiLoadPromise;
}
