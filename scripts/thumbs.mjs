// Capture light and dark thumbnails for the index.
//
//   npm run build && npm run preview      (in another terminal)
//   npm run thumbs                        every demo
//   npm run thumbs -- rope orb            just these
//   npm run thumbs -- --missing           only demos without thumbnails
//
// Screenshots come from THUMB_SHOT, a command template with {url} and {out}.
// The default uses the Playwright CLI. A command that writes elsewhere may
// instead print "saved <path>" and that file is used.
import { execSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const BASE = process.env.THUMB_BASE ?? "http://localhost:4321";
const SHOT = process.env.THUMB_SHOT ??
  "npx playwright screenshot --viewport-size=800,600 --wait-for-timeout=2500 {url} {out}";
const OUT = "public/thumbs";

const args = process.argv.slice(2);
const missing = args.includes("--missing");
const all = readdirSync("src/demos", { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join("src/demos", d.name, "demo.ts")))
  .map((d) => d.name);
const wanted = args.filter((a) => !a.startsWith("--"));
const slugs = (wanted.length ? wanted : all).filter(
  (s) => !missing || !existsSync(join(OUT, `${s}-light.webp`)),
);

for (const slug of slugs) {
  for (const theme of ["light", "dark"]) {
    const url = `${BASE}/${slug}/?thumb&theme=${theme}`;
    const tmp = join(tmpdir(), `thumb-${slug}-${theme}.png`);
    const said = execSync(SHOT.replace("{url}", `'${url}'`).replace("{out}", tmp), { encoding: "utf8" });
    const file = said.match(/saved (\S+)/)?.[1] ?? tmp;
    const dest = join(OUT, `${slug}-${theme}.webp`);
    await sharp(file).resize(800, 600, { fit: "cover" }).webp({ quality: 78 }).toFile(dest);
    rmSync(file, { force: true });
    console.log(dest);
  }
}
