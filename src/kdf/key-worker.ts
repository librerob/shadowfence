import { argonKey } from "./argon";

self.onmessage = async (e: MessageEvent) => {
  try {
    const { password, salt, profile } = e.data ?? {};
    if (!(password instanceof Uint8Array) || !(salt instanceof Uint8Array))
      throw new Error("Invalid key derivation request.");
    const key = await argonKey(password, salt, profile);
    // Structured cloning keeps the key non-extractable. No raw key is returned.
    self.postMessage({ key });
  } catch {
    self.postMessage({ error: "Key derivation failed. Please try again." });
  }
};
