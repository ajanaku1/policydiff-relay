import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const videoRoot = new URL(".", import.meta.url).pathname;
const timings = JSON.parse(
  readFileSync(join(videoRoot, "subtitle-timings.json"), "utf8"),
);
const input = join(videoRoot, "out", ".base-demo.mp4");
const output = join(videoRoot, "out", "policydiff-relay-demo.mp4");
const args = ["-y", "-i", input];
const filters = [];
const streams = [];

for (const [index, subtitle] of timings.entries()) {
  const duration = subtitle.duration.toFixed(3);
  args.push(
    "-loop", "1",
    "-framerate", "30",
    "-t", duration,
    "-i", join(videoRoot, "public", "subtitles", `${subtitle.id}.png`),
  );
  filters.push(
    `[${index + 1}:v]format=rgba,trim=duration=${duration},setpts=PTS-STARTPTS[sub${index}]`,
  );
  streams.push(`[sub${index}]`);
}

filters.push(
  `${streams.join("")}concat=n=${streams.length}:v=1:a=0[subtitles]`,
  "[0:v][subtitles]overlay=0:0:shortest=1[vout]",
);
args.push(
  "-filter_complex", filters.join(";"),
  "-map", "[vout]",
  "-map", "0:a",
  "-c:v", "libx264",
  "-preset", "medium",
  "-crf", "18",
  "-pix_fmt", "yuv420p",
  "-c:a", "copy",
  "-movflags", "+faststart",
  output,
);

const result = spawnSync("ffmpeg", args, { stdio: "inherit" });
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
