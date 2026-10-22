# Image matching

The fingerprint format is versioned (`algorithm: 1`). SHA-256 covers the original file bytes.
Visual processing uses Chrome's decoder with EXIF orientation, a 256×256 intermediate image,
white alpha compositing, and browser high-quality resizing.

pHash uses 32×32 luminance samples and the top-left 8×8 DCT coefficients, excluding DC. The
remaining 63 coefficients are compared to their median and stored in a 16-character hex value.
dHash compares horizontal neighbors in a 9×8 luminance image. Luminance weights are
0.299 red, 0.587 green, and 0.114 blue. These classic methods are structural, not face recognition.

For nonidentical bytes, a possible match requires pHash Hamming distance at most 8 **and** dHash
distance at most 10. Images with luminance standard deviation below 8 use exact matching only.
These are conservative candidate thresholds evaluated against the reproducible fixtures; they
are not confidence probabilities. Changing them requires rerunning and documenting evaluation.

## Reproducible evaluation

`tests/generate-images.mjs` makes eight variants of each of six public-domain/CC0 photographs:
160px resize, JPEG quality 35, 12% brighter JPEG, saturation/hue change, central 80% crop,
90-degree rotation, a screenshot-like border, and WebP encoding. `tests/browser.mjs` runs the
production worker in an installed extension. It saves each fingerprint, distances obtainable from
those fingerprints, processing times, and detection counts to `test-results/image-evaluation.json`.

The browser suite requires all six resize and all six JPEG-recompression pairs to match. It checks
all 15 pairs of unrelated originals and requires zero warnings. Harder transformations are reported
without treating their incidental detection as a supported capability. Byte-identical registration,
same-identity handling, intentional reuse and invalid files are exercised through the actual UI.

This is a small engineering regression set, not a representative benchmark. Thresholds need a
larger independent photographic corpus before any broad reliability claim. Different photographs
of the same person are not detected intentionally; a dedicated same-person negative dataset has
not yet been evaluated. Screenshots are simulated by adding borders, not a complete OS capture.
Browser decoder/resampler differences may affect perceptual fingerprints near a threshold.

## Unsupported guarantees

Cropping, rotations, mirroring, screenshots, overlays, heavy color editing and adversarial changes
can evade these hashes. Similar layouts can collide. A match does not prove two accounts have a
common owner, and no match is not evidence of anonymity. Only exact file equality is definitive
about the file bytes. No face recognition, embedding model or reverse-image service is used.
