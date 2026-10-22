import { fingerprint } from "./process";
self.onmessage = async (e: MessageEvent<Blob>) => {
  try {
    if (!(e.data instanceof Blob)) throw new Error("Invalid image request.");
    self.postMessage({ result: await fingerprint(e.data) });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error
          ? error.message
          : "This image could not be read.",
    });
  }
};
