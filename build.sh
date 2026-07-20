#!/bin/bash
# 打包优易调度管理 APatch 模块
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT="$ROOT/youyi_sched.zip"

cd "$ROOT/youyi_sched"
zip -r "$OUT" . \
  -x "*.DS_Store" \
  -x "*/._*" \
  -x "._*" \
  -x "run/*" \
  -x "logs/*" \
  -x "state_backup/*"

echo "已生成: $OUT"
ls -lh "$OUT"
