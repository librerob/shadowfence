# Test photographs

These six images are test inputs, not extension assets. They come from the
[scikit-image 0.25.2 sample collection](https://github.com/scikit-image/scikit-image/tree/v0.25.2/skimage/data).
The collection's [`_fetchers.py`](https://github.com/scikit-image/scikit-image/blob/v0.25.2/skimage/data/_fetchers.py)
records the following provenance:

| File                  | Credit and terms                                      |
| --------------------- | ----------------------------------------------------- |
| astronaut.png         | NASA, Eileen Collins portrait; public domain          |
| camera.png            | Lav Varshney; CC0                                     |
| chelsea.png           | Stefan van der Walt; CC0                              |
| coffee.png            | Rachel Michetti, courtesy of Pikolo Espresso Bar; CC0 |
| rocket.jpg            | SpaceX, DSCOVR launch; public domain                  |
| hubble_deep_field.jpg | NASA, Hubble eXtreme Deep Field; public domain        |
| collins-flight.jpg | NASA, STS093-309-027, Eileen Collins on Columbia's middeck; public domain |

SHA-256 checksums of the downloaded originals:

```text
88431cd9653ccd539741b555fb0a46b61558b301d4110412b5bc28b5e3ea6cb5  astronaut.png
cc02f8ca188b167c775a7101b5d767d1e71792cf762c33d6fa15a4599b5a8de7  coffee.png
596aa1e7cb875eb79f437e310381d26b338a81c2da23439704a73c4651e8c4bb  chelsea.png
b0793d2adda0fa6ae899c03989482bff9a42d3d5690fc7e3648f2795d730c23a  camera.png
c2dd0de7c538df8d111e479619b129464d0269d0ae5fd18ca91d33a7fdfea95c  rocket.jpg
3a19c5dd8a927a9334bb1229a6d63711b1c0c767fb27e2286e7c84a3e2c2f5f4  hubble_deep_field.jpg
294434d55c19f00bfe4c078da58a93c908bc3df20e6925daff7c71830986e667  collins-flight.jpg
```

Generated variants are reproducible with `node tests/generate-images.mjs`.
No claim of general photographic coverage follows from this small corpus.

The seventh photo is a negative control against the astronaut portrait: a distinct photograph
of the same person should not match. [NASA's source and caption](https://www.nasa.gov/image-article/astronaut-eileen-collins-nasas-first-female-shuttle-commander/),
[image file](https://www.nasa.gov/wp-content/uploads/2024/07/sts093-309-027orig.jpg).
