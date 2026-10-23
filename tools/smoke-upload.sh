#!/usr/bin/env bash
# ใช้: tools/smoke-upload.sh <exec_url> <app_key> [school_id=changkon8]
# ส่ง PNG 1536x2304 ทดสอบเข้า Apps Script ที่ deploy แล้ว · exit 0 เมื่อตอบ "ok":true
set -euo pipefail

EXEC_URL="${1:?usage: smoke-upload.sh <exec_url> <app_key> [school_id]}"
APP_KEY="${2:?usage: smoke-upload.sh <exec_url> <app_key> [school_id]}"
SCHOOL_ID="${3:-changkon8}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

REPORT_ID="$(uuidgen | tr 'A-Z' 'a-z')"
REPORT_DATE="$(TZ=Asia/Bangkok date +%F)"
FILE_NAME="วันเพจ_ทดสอบ_$(TZ=Asia/Bangkok date +%F)_$(TZ=Asia/Bangkok date +%H%M).png"

# สร้าง payload ด้วย sharp (devDependency) — พื้นเรียบ 1536x2304
(cd "$ROOT" && REPORT_ID="$REPORT_ID" REPORT_DATE="$REPORT_DATE" FILE_NAME="$FILE_NAME" \
  APP_KEY="$APP_KEY" SCHOOL_ID="$SCHOOL_ID" OUT="$TMP/payload.json" node -e '
const sharp = require("sharp");
const fs = require("fs");
const e = process.env;
sharp({ create: { width: 1536, height: 2304, channels: 3, background: "#7d4bc4" } })
  .png().toBuffer().then((buf) => {
    const payload = {
      v: 1, app_key: e.APP_KEY, report_id: e.REPORT_ID, school_id: e.SCHOOL_ID,
      report_date: e.REPORT_DATE, teacher_ids: [e.SCHOOL_ID + "-01"], teacher_names: ["ทดสอบ ระบบ"],
      template_id: "smoke", template_version: 1, app_version: 1,
      file_name: e.FILE_NAME, mime: "image/png", data_b64: buf.toString("base64"), ua: "smoke-upload.sh",
    };
    fs.writeFileSync(e.OUT, JSON.stringify(payload));
  }).catch((err) => { console.error(err); process.exit(1); });
')

echo "ส่ง $FILE_NAME ($SCHOOL_ID) report_id=$REPORT_ID"
RESP="$(curl -sL -H 'Content-Type: text/plain' --data-binary @"$TMP/payload.json" "$EXEC_URL")"
echo "$RESP"
if printf '%s' "$RESP" | grep -q '"ok":true'; then
  echo "PASS"
  exit 0
fi
echo "FAIL" >&2
exit 1
