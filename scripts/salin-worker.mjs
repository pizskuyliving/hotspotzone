// MapLibre v6 memuat web worker dari file terpisah yang tidak ikut di-bundle
// Next.js, jadi file worker disalin ke public/ sebelum dev dan build.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve("maplibre-gl/package.json"));
mkdirSync("public", { recursive: true });
copyFileSync(join(dist, "dist", "maplibre-gl-worker.mjs"), join("public", "maplibre-gl-worker.mjs"));
