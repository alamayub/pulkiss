import { useEffect, useState } from "react";

/**
 * When to show a centered avatar over the video: no live video track, element paused,
 * or no decoded frame data yet (no stream / loading / stalled WebRTC).
 *
 * @param {React.RefObject<HTMLVideoElement | null>} videoRef
 * @param {boolean} trackLive — video track exists and is enabled
 * @param {boolean} [active=true] — skip updates when false (e.g. remote tile when not in a call)
 */
export function useVideoCenterAvatar(videoRef, trackLive, active = true) {
  const [needsCenter, setNeedsCenter] = useState(true);

  useEffect(() => {
    if (!active) {
      setNeedsCenter(true);
      return undefined;
    }

    const v = videoRef.current;
    if (!v) {
      setNeedsCenter(true);
      return undefined;
    }

    const sync = () => {
      if (!trackLive) {
        setNeedsCenter(true);
        return;
      }
      const paused = v.paused;
      const noFramesYet = v.readyState < HTMLVideoElement.HAVE_CURRENT_DATA;
      setNeedsCenter(paused || noFramesYet);
    };

    sync();

    v.addEventListener("playing", sync);
    v.addEventListener("pause", sync);
    v.addEventListener("loadeddata", sync);
    v.addEventListener("loadedmetadata", sync);
    v.addEventListener("canplay", sync);
    v.addEventListener("emptied", sync);
    v.addEventListener("suspend", sync);
    v.addEventListener("waiting", sync);
    v.addEventListener("stalled", sync);
    v.addEventListener("ended", sync);

    const id = window.setInterval(sync, 500);

    return () => {
      window.clearInterval(id);
      v.removeEventListener("playing", sync);
      v.removeEventListener("pause", sync);
      v.removeEventListener("loadeddata", sync);
      v.removeEventListener("loadedmetadata", sync);
      v.removeEventListener("canplay", sync);
      v.removeEventListener("emptied", sync);
      v.removeEventListener("suspend", sync);
      v.removeEventListener("waiting", sync);
      v.removeEventListener("stalled", sync);
      v.removeEventListener("ended", sync);
    };
  }, [videoRef, trackLive, active]);

  return needsCenter;
}
