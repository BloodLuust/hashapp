#!/usr/bin/env bash
set -Eeuo pipefail

# process_video_for_review.sh
# Prepare a screen recording for easy review:
# - Extract metadata (ffprobe)
# - Generate compatible MP4 (H.264/AAC) and WebM (VP9/Opus)
# - Create keyframe thumbnails, a storyboard strip, and a short GIF
# - Build a local HTML preview to view in any browser
# - Optional OCR of sampled frames if tesseract is available
#
# Usage:
#   scripts/process_video_for_review.sh [-i INPUT] [-o OUTDIR] [--start 00:00:00] [--dur 00:00:20] [--no-open] [--no-ocr]
# Examples:
#   scripts/process_video_for_review.sh
#   scripts/process_video_for_review.sh -i "study/Screen Recording*.mov" --no-ocr
#   scripts/process_video_for_review.sh -i path/to/video.mov -o review_out --start 00:00:15 --dur 00:00:30

INPUT=""
OUTDIR=""
NO_OPEN=0
NO_OCR=0
START=""
DUR=""

usage() {
  sed -n '1,40p' "$0" | sed 's/^# \{0,1\}//'
}

have() { command -v "$1" >/dev/null 2>&1; }

timestamp() { date +"%Y%m%d-%H%M%S"; }

fail_missing() {
  local missing=()
  for cmd in "$@"; do
    have "$cmd" || missing+=("$cmd")
  done
  if ((${#missing[@]})); then
    echo "[ERROR] Missing dependencies: ${missing[*]}" >&2
    echo "Install on macOS: brew install ffmpeg tesseract imagemagick" >&2
    echo "Install on Ubuntu: sudo apt-get update && sudo apt-get install -y ffmpeg tesseract-ocr imagemagick" >&2
    exit 1
  fi
}

open_if_macos() {
  if [[ $NO_OPEN -eq 0 ]] && [[ $(uname -s) == "Darwin" ]] && have open; then
    open "$1" || true
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -i|--input) INPUT="$2"; shift 2 ;;
    -o|--outdir) OUTDIR="$2"; shift 2 ;;
    --start) START="$2"; shift 2 ;;
    --dur|--duration) DUR="$2"; shift 2 ;;
    --no-open) NO_OPEN=1; shift ;;
    --no-ocr) NO_OCR=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 1 ;;
  esac
done

# Resolve input
if [[ -z "$INPUT" ]]; then
  # Try to find a likely screen recording under study/
  # Support macOS filenames with special spaces by using globbing
  shopt -s nullglob
  candidates=(study/*.mov study/*.mp4 study/*.m4v study/*.webm study/*.mkv)
  shopt -u nullglob
  if ((${#candidates[@]} == 0)); then
    echo "[ERROR] No input provided and no video found under study/. Use -i to specify." >&2
    exit 1
  fi
  INPUT="${candidates[0]}"
fi

# Expand globs if any
eval "set -- $INPUT" || true
if [[ $# -gt 0 ]]; then INPUT="$1"; fi

if [[ ! -f "$INPUT" ]]; then
  echo "[ERROR] Input not found: $INPUT" >&2
  exit 1
fi

# Dependencies: ffmpeg/ffprobe required; tesseract optional
fail_missing ffmpeg ffprobe

base="$(basename -- "$INPUT")"
stem="${base%.*}"
ts="$(timestamp)"
OUTDIR="${OUTDIR:-learn_artifacts/${stem}-${ts}}"
mkdir -p "$OUTDIR"

echo "[INFO] Input: $INPUT"
echo "[INFO] Output dir: $OUTDIR"

# 1) Metadata
echo "[INFO] Extracting metadata (ffprobe)"
ffprobe -hide_banner -i "$INPUT" 2>"$OUTDIR/metadata.txt" || true

# Get duration in seconds
dur_s=$(ffprobe -v error -select_streams v:0 -show_entries format=duration -of default=nw=1:nk=1 "$INPUT" 2>/dev/null | awk '{printf("%d", $1)}') || dur_s=0
(( dur_s <= 0 )) && dur_s=60

# 2) Transcodes
echo "[INFO] Transcoding MP4 (H.264/AAC, 720p)"
ffmpeg -y -hide_banner -loglevel error -i "$INPUT" \
  -vf "scale='min(1280,iw)':-2" -pix_fmt yuv420p -c:v libx264 -preset veryfast -crf 23 \
  -c:a aac -b:a 128k "$OUTDIR/${stem}.mp4"

echo "[INFO] Transcoding WebM (VP9/Opus, 720p)"
ffmpeg -y -hide_banner -loglevel error -i "$INPUT" \
  -vf "scale='min(1280,iw)':-2" -pix_fmt yuv420p -c:v libvpx-vp9 -crf 33 -b:v 0 \
  -c:a libopus -b:a 96k "$OUTDIR/${stem}.webm"

# Short preview clip (10-20s)
clip_start=${START:-00:00:00}
clip_dur=${DUR:-00:00:15}
echo "[INFO] Making short preview clip mp4 (${clip_start} + ${clip_dur})"
ffmpeg -y -hide_banner -loglevel error -ss "$clip_start" -t "$clip_dur" -i "$INPUT" \
  -vf "scale='min(1280,iw)':-2" -c:v libx264 -preset veryfast -crf 23 -c:a aac -b:a 128k \
  "$OUTDIR/${stem}.preview.mp4"

# 3) Thumbnails and storyboard
echo "[INFO] Generating keyframe thumbnails"
# Pick 3 timestamps at ~20%, 50%, 80%
ts1=$(( dur_s * 20 / 100 ))
ts2=$(( dur_s * 50 / 100 ))
ts3=$(( dur_s * 80 / 100 ))
for sec in "$ts1" "$ts2" "$ts3"; do
  ffmpeg -y -hide_banner -loglevel error -ss "$sec" -i "$INPUT" -frames:v 1 \
    -vf "scale='min(1280,iw)':-2" "$OUTDIR/thumb_${sec}s.jpg"
done

echo "[INFO] Generating storyboard (1 frame every 10s)"
ffmpeg -y -hide_banner -loglevel error -i "$INPUT" \
  -vf "fps=1/10,scale=480:-2,tile=5x" "$OUTDIR/storyboard.jpg"

echo "[INFO] Making a 6s GIF preview"
ffmpeg -y -hide_banner -loglevel error -ss "$clip_start" -t 6 -i "$INPUT" \
  -vf "fps=12,scale=640:-2:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" \
  "$OUTDIR/${stem}.preview.gif"

# 4) Optional OCR of sampled frames
if [[ $NO_OCR -eq 0 ]] && have tesseract; then
  echo "[INFO] OCR: sampling 1 frame every 5s (max 60 frames)"
  mkdir -p "$OUTDIR/ocr_frames"
  ffmpeg -y -hide_banner -loglevel error -i "$INPUT" -vf "fps=1/5,scale=1280:-2" "$OUTDIR/ocr_frames/f%04d.jpg"
  echo "[INFO] Running tesseract (may take a moment)"
  : > "$OUTDIR/ocr.txt"
  count=0
  for img in "$OUTDIR"/ocr_frames/*.jpg; do
    [[ -e "$img" ]] || break
    ((count++));
    tesseract "$img" stdout 2>/dev/null | sed -E "s/^/[$(basename "$img")] /" >> "$OUTDIR/ocr.txt" || true
    (( count >= 60 )) && break
  done
else
  echo "[INFO] Skipping OCR (use --no-ocr to silence or install tesseract)"
fi

# 5) HTML preview
echo "[INFO] Building HTML preview"
cat > "$OUTDIR/index.html" <<HTML
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Video Preview - ${stem}</title>
  <style>
    body { font-family: -apple-system, system-ui, Segoe UI, Roboto, sans-serif; margin: 1.5rem; }
    video { max-width: 100%; height: auto; background: #000; }
    .thumbs img { height: 120px; margin-right: 8px; border: 1px solid #ccc; }
    code { background: #f5f5f5; padding: 2px 4px; border-radius: 3px; }
  </style>
  </head>
<body>
  <h1>${stem}</h1>
  <p>Generated: $(date)</p>
  <h2>Player</h2>
  <video controls preload="metadata">
    <source src="${stem}.mp4" type="video/mp4" />
    <source src="${stem}.webm" type="video/webm" />
    Your browser does not support the video tag.
  </video>
  <h2>Quick Preview</h2>
  <p><a href="${stem}.preview.mp4">${stem}.preview.mp4</a> · <a href="${stem}.preview.gif">${stem}.preview.gif</a></p>
  <h2>Thumbnails</h2>
  <div class="thumbs">
    $(for f in "$OUTDIR"/thumb_*.jpg; do b=$(basename "$f"); echo "<img src=\"$b\" alt=\"$b\">"; done)
  </div>
  <h2>Storyboard</h2>
  <img src="storyboard.jpg" alt="storyboard" style="max-width:100%; height:auto; border:1px solid #ccc;"/>
  <h2>Metadata</h2>
  <pre>$(sed 's/&/&amp;/g; s/</\&lt;/g' "$OUTDIR/metadata.txt" | sed 's/>/\&gt;/g')</pre>
  $( [[ -f "$OUTDIR/ocr.txt" ]] && echo "<h2>OCR (sampled)</h2><pre>$(sed 's/&/&amp;/g; s/</\&lt;/g' \"$OUTDIR/ocr.txt\" | sed 's/>/\&gt;/g')</pre>" )
</body>
</html>
HTML

echo "[INFO] Done. Outputs in: $OUTDIR"
echo "[INFO] Open the preview: $OUTDIR/index.html"
open_if_macos "$OUTDIR/index.html"

