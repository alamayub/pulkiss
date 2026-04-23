/**
 * @returns {Array<{ urls: string | string[] }>}
 */
function getIceServers() {
  if (process.env.ICE_SERVERS) {
    try {
      const parsed = JSON.parse(process.env.ICE_SERVERS);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed;
      }
    } catch {
      // use default
    }
  }
  return [{ urls: "stun:stun.l.google.com:19302" }];
}

export { getIceServers };
