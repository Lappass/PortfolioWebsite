// Copies a Unity WebGL build into public/works/<id>/unity/ for the project page's Play frame.
//   node scripts/pack-webgl.mjs <unity build folder> <id> "<title>"
// The build must use Gzip with decompression fallback. Static hosting sends no Content-Encoding
// header for these files, so the page unpacks them itself with the browser's DecompressionStream
// while they download (fast, native); Unity's own JavaScript decoder is only the fallback.
// Files are renamed with a content hash so they can be cached forever, and any file over
// 90 MiB (GitHub refuses files over 100 MB) is split into parts that the page joins again.
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { cp, mkdir, open, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const [source, id, title] = process.argv.slice(2);
if (!source || !/^x-\d{3}$/.test(id ?? "") || !title) {
  console.error('Usage: node scripts/pack-webgl.mjs <unity build folder> <x-00N> "<title>"');
  process.exit(1);
}
const PART = 90 * 1024 * 1024;
const build = resolve(source, "Build");
const out = resolve("public/works", id, "unity");
const names = await readdir(build);
const pick = (suffix) => {
  const name = names.find((n) => n.endsWith(suffix));
  if (!name) throw Error(`No *${suffix} in ${build}`);
  return name;
};

const digest = (path) =>
  new Promise((ok, fail) => {
    const hash = createHash("sha256");
    createReadStream(path).on("data", (d) => hash.update(d)).on("end", () => ok(hash.digest("hex").slice(0, 10))).on("error", fail);
  });
const withHash = async (name) => name.replace(/^[^.]+/, `$&-${await digest(join(build, name))}`);

await rm(out, { recursive: true, force: true });
await mkdir(join(out, "Build"), { recursive: true });

const loaderName = await withHash(pick(".loader.js"));
await cp(join(build, pick(".loader.js")), join(out, "Build", loaderName));

const urls = { loader: `Build/${loaderName}` };
// url -> { parts, size (unpacked) } for every gzip file the page fetches.
const packed = {};
let download = 0;
for (const [key, suffix] of [["framework", ".framework.js.unityweb"], ["code", ".wasm.unityweb"], ["data", ".data.unityweb"]]) {
  const name = pick(suffix);
  const from = join(build, name);
  const size = (await stat(from)).size;
  download += size;
  const hashed = await withHash(name);
  urls[key] = `Build/${hashed}`;

  const handle = await open(from);
  const head = Buffer.alloc(2), tail = Buffer.alloc(4);
  await handle.read(head, 0, 2, 0);
  await handle.read(tail, 0, 4, size - 4);
  if (head[0] !== 0x1f || head[1] !== 0x8b) throw Error(`${name} is not gzip: build with Gzip compression`);
  const unpacked = tail.readUInt32LE(0); // gzip ISIZE; every file here is under 4 GB

  const list = [];
  if (size <= PART) {
    await cp(from, join(out, "Build", hashed));
    list.push(`Build/${hashed}`);
  } else {
    for (let offset = 0, i = 0; offset < size; offset += PART, i++) {
      const length = Math.min(PART, size - offset);
      const buffer = Buffer.alloc(length);
      await handle.read(buffer, 0, length, offset);
      await writeFile(join(out, "Build", `${hashed}.part${i}`), buffer);
      list.push(`Build/${hashed}.part${i}`);
    }
  }
  await handle.close();
  packed[urls[key]] = { parts: list, size, unpacked, type: key === "code" ? "application/wasm" : "application/octet-stream" };
}

const streaming = resolve(source, "StreamingAssets");
if (await stat(streaming).then(() => true, () => false)) await cp(streaming, join(out, "StreamingAssets"), { recursive: true });

const mb = Math.round(download / 1024 / 1024);
await writeFile(join(out, "index.html"), page({ title, urls, packed, mb }));
const split = Object.values(packed).filter((p) => p.parts.length > 1);
console.log(`${id}: ${mb} MB into ${out}${split.length ? ` (data in ${split.map((p) => p.parts.length).join("+")} parts)` : ""}`);

function page({ title, urls, packed, mb }) {
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
<title>${esc(title)}</title>
<style>
  html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
  canvas { display: block; width: 100%; height: 100%; outline: none; }
  #load { position: fixed; inset: 0; display: grid; place-content: center; gap: 14px; justify-items: center;
    color: #d8d8d8; font: 14px/1.4 system-ui, sans-serif; text-align: center; padding: 24px; }
  #bar { width: min(320px, 70vw); height: 2px; background: #333; }
  #fill { height: 100%; width: 0; background: #e8e8e8; transition: width .2s; }
  #note { color: #8a8a8a; font-size: 12px; }
</style>
</head>
<body>
<canvas id="game" tabindex="-1"></canvas>
<div id="load">
  <div>Loading ${esc(title)}</div>
  <div id="bar"><div id="fill"></div></div>
  <div id="note">About ${mb} MB the first time, then it is kept in the browser.</div>
</div>
<script>
  // Each Unity file is gzip, maybe in parts. Join the parts and let the browser unpack them as
  // they arrive, so Unity gets plain bytes. Without DecompressionStream, Unity unpacks them itself.
  var packed = ${JSON.stringify(packed)};
  var native = typeof DecompressionStream === "function";
  var realFetch = window.fetch.bind(window);
  var byUrl = {};
  Object.keys(packed).forEach(function (u) { byUrl[new URL(u, location.href).href] = packed[u]; });
  window.fetch = function (input, init) {
    var href = new URL(typeof input === "string" ? input : input.url, location.href).href;
    var entry = byUrl[href];
    if (!entry) return realFetch(input, init);
    var i = 0, reader = null;
    var body = new ReadableStream({
      pull: async function (controller) {
        try {
          for (;;) {
            if (!reader) {
              if (i >= entry.parts.length) { controller.close(); return; }
              var res = await realFetch(entry.parts[i++]);
              if (!res.ok) throw new Error("HTTP " + res.status + " for " + res.url);
              reader = res.body.getReader();
            }
            var chunk = await reader.read();
            if (chunk.done) { reader = null; continue; }
            controller.enqueue(chunk.value);
            return;
          }
        } catch (err) { controller.error(err); }
      }
    });
    if (native) body = body.pipeThrough(new DecompressionStream("gzip"));
    return Promise.resolve(new Response(body, { status: 200, headers: {
      "Content-Type": entry.type, "Content-Length": String(native ? entry.unpacked : entry.size) } }));
  };

  var canvas = document.getElementById("game");
  var fill = document.getElementById("fill");
  var load = document.getElementById("load");
  var config = {
    dataUrl: ${JSON.stringify(urls.data)},
    frameworkUrl: ${JSON.stringify(urls.framework)},
    codeUrl: ${JSON.stringify(urls.code)},
    streamingAssetsUrl: "StreamingAssets",
    companyName: "Lappas",
    productName: ${JSON.stringify(title)},
    productVersion: "web",
    // File names carry a content hash, so a cached copy never needs checking again.
    cacheControl: function () { return "immutable"; },
    autoSyncPersistentDataPath: true,
    showBanner: function (msg, type) { if (type === "error") showError(msg); else console.warn(msg); }
  };
  function showError(msg) {
    load.style.display = "grid";
    load.innerHTML = "<div>The game could not start in this browser.</div><div id=note></div>";
    load.querySelector("#note").textContent = String(msg);
  }
  var script = document.createElement("script");
  script.src = ${JSON.stringify(urls.loader)};
  script.onload = function () {
    createUnityInstance(canvas, config, function (p) { fill.style.width = (100 * p) + "%"; })
      .then(function () { load.style.display = "none"; canvas.focus(); })
      .catch(showError);
  };
  script.onerror = function () { showError("The loader did not download."); };
  document.body.appendChild(script);
  canvas.addEventListener("pointerdown", function () { canvas.focus(); });
</script>
</body>
</html>
`;
}
