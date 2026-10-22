import { isFingerprint, type Fingerprint } from "../core/model";
export function analyzeImage(
  file: File,
  signal?: AbortSignal,
): Promise<Fingerprint> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Image check cancelled."));
      return;
    }
    const worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    const stop = () => {
      worker.terminate();
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    };
    const abort = () => {
      stop();
      reject(new Error("Image check cancelled."));
    };
    const timer = setTimeout(() => {
      stop();
      reject(
        new Error("This image took too long to process. Try a smaller file."),
      );
    }, 15000);
    signal?.addEventListener("abort", abort, { once: true });
    worker.onmessage = (e) => {
      stop();
      if (isFingerprint(e.data?.result)) resolve(e.data.result);
      else reject(new Error(e.data?.error || "Invalid image response."));
    };
    worker.onerror = () => {
      stop();
      reject(new Error("This image could not be decoded."));
    };
    worker.postMessage(file);
  });
}
