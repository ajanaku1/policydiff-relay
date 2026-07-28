import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const videoRoot = new URL(".", import.meta.url).pathname;
const subtitleRoot = join(videoRoot, "public", "subtitles");

function parseTimestamp(value) {
  const [clock, milliseconds] = value.split(",");
  const [hours, minutes, seconds] = clock.split(":").map(Number);
  return hours * 3600 + minutes * 60 + seconds + Number(milliseconds) / 1000;
}

function parseSubtitles(content) {
  return content.trim().split(/\n\n+/).map((block) => {
    const [id, timing, ...textLines] = block.split("\n");
    const [start, end] = timing.split(" --> ");
    return {
      duration: parseTimestamp(end) - parseTimestamp(start),
      id: id.padStart(2, "0"),
      textLines,
    };
  });
}

function escapeXml(value) {
  return value.replace(/[&<>"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  })[character]);
}

function subtitleSvg(lines) {
  const firstY = lines.length === 1 ? 974 : 950;
  const text = lines.map((line, index) =>
    `<text x="960" y="${firstY + index * 44}" text-anchor="middle">${escapeXml(line)}</text>`
  ).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">
    <rect x="170" y="890" width="1580" height="135" rx="20" fill="#0f2d2b" fill-opacity="0.82"/>
    <g fill="#ffffff" font-family="Arial, sans-serif" font-size="35" font-weight="600">${text}</g>
  </svg>`;
}

function closeSvg(imageData) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">
    <image href="data:image/png;base64,${imageData}" width="1920" height="1200" y="-60"/>
    <rect width="1920" height="1080" fill="#0f2d2b" fill-opacity="0.84"/>
    <text x="960" y="450" text-anchor="middle" fill="#ffffff" font-family="Georgia, serif" font-size="96" font-weight="700">PolicyDiff Relay</text>
    <text x="960" y="540" text-anchor="middle" fill="#9ec5ba" font-family="Arial, sans-serif" font-size="44">From change to closure</text>
    <text x="960" y="635" text-anchor="middle" fill="#8ebcff" font-family="Arial, sans-serif" font-size="30">policydiff-relay-8292a74a.base44.app</text>
  </svg>`;
}

function renderSvg(svg, outputPath) {
  const sourcePath = `${outputPath}.svg`;
  writeFileSync(sourcePath, svg);
  execFileSync("rsvg-convert", [
    "-w", "1920", "-h", "1080", "-o", outputPath, sourcePath,
  ]);
}

mkdirSync(subtitleRoot, { recursive: true });
const subtitles = parseSubtitles(
  readFileSync(join(videoRoot, "subtitles.srt"), "utf8"),
);
for (const subtitle of subtitles) {
  renderSvg(
    subtitleSvg(subtitle.textLines),
    join(subtitleRoot, `${subtitle.id}.png`),
  );
}
writeFileSync(
  join(videoRoot, "subtitle-timings.json"),
  `${JSON.stringify(subtitles, null, 2)}\n`,
);
const controlRoom = readFileSync(
  join(videoRoot, "public", "assets", "control-room.png"),
).toString("base64");
renderSvg(
  closeSvg(controlRoom),
  join(videoRoot, "public", "assets", "close.png"),
);
