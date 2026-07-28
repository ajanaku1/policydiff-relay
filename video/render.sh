#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

node video/build-overlays.mjs

ffmpeg -y \
  -framerate 30 -loop 1 -t 8.618 -i video/public/assets/control-room.png \
  -framerate 30 -loop 1 -t 16.675 -i video/public/assets/control-room.png \
  -framerate 30 -loop 1 -t 17.489 -i video/public/assets/evidence.png \
  -framerate 30 -loop 1 -t 18.989 -i video/public/assets/closure.png \
  -framerate 30 -loop 1 -t 21.516 -i video/public/assets/agent-audit.png \
  -framerate 30 -loop 1 -t 10.759 -i video/public/assets/close.png \
  -i video/public/audio/01-hook.m4a \
  -i video/public/audio/02-incident.m4a \
  -i video/public/audio/03-evidence.m4a \
  -i video/public/audio/04-closure.m4a \
  -i video/public/audio/05-agent-audit.m4a \
  -i video/public/audio/06-close.m4a \
  -filter_complex "
    [0:v]scale=1920:1200,crop=1920:1080,zoompan=z='min(zoom+0.00012,1.035)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30,trim=duration=8.618,setpts=PTS-STARTPTS[v0];
    [1:v]scale=1920:1200,crop=1920:1080,zoompan=z='min(zoom+0.00008,1.025)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30,trim=duration=16.675,setpts=PTS-STARTPTS[v1];
    [2:v]scale=1920:1200,crop=1920:1080,zoompan=z='min(zoom+0.00008,1.025)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30,trim=duration=17.489,setpts=PTS-STARTPTS[v2];
    [3:v]scale=1920:1200,crop=1920:1080,zoompan=z='min(zoom+0.00008,1.025)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30,trim=duration=18.989,setpts=PTS-STARTPTS[v3];
    [4:v]zoompan=z='min(zoom+0.00008,1.025)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30,trim=duration=21.516,setpts=PTS-STARTPTS[v4];
    [5:v]zoompan=z='min(zoom+0.00008,1.025)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30,trim=duration=10.759,setpts=PTS-STARTPTS[v5];
    [v0][v1]xfade=transition=fade:duration=0.8:offset=7.818[x1];
    [x1][v2]xfade=transition=fade:duration=0.8:offset=23.693[x2];
    [x2][v3]xfade=transition=fade:duration=0.8:offset=40.382[x3];
    [x3][v4]xfade=transition=fade:duration=0.8:offset=58.571[x4];
    [x4][v5]xfade=transition=fade:duration=0.8:offset=79.287,
      fade=t=out:st=88.046:d=2[vout];
    [6:a][7:a][8:a][9:a][10:a][11:a]concat=n=6:v=0:a=1,afade=t=out:st=89.046:d=1[aout]
  " \
  -map "[vout]" -map "[aout]" \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -movflags +faststart \
  video/out/.base-demo.mp4

node video/burn-subtitles.mjs
rm -f video/out/.base-demo.mp4

ffmpeg -y \
  -framerate 30 -loop 1 -t 10 -i docs/images/control-room-mobile.png \
  -vf "scale=1080:-2,crop=1080:1920:0:0,zoompan=z='min(zoom+0.0002,1.04)':x='iw/2-(iw/zoom/2)':y=0:d=1:s=1080x1920:fps=30,fade=t=out:st=9.3:d=0.7" \
  -t 10 -an -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
  -movflags +faststart video/out/policydiff-relay-social.mp4
