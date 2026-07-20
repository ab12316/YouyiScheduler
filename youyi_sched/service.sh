#!/system/bin/sh
MODDIR=${0%/*}

# 等待系统服务就绪
sleep 15

if [ -f "$MODDIR/disable" ] || [ -f "$MODDIR/remove" ]; then
    exit 0
fi

# 停止旧实例
if [ -f "$MODDIR/run/apm-daemon.pid" ]; then
    kill "$(cat "$MODDIR/run/apm-daemon.pid")" 2>/dev/null
    rm -f "$MODDIR/run/apm-daemon.pid"
fi

# 启动守护进程
nohup sh "$MODDIR/bin/apm-daemon" >> "$MODDIR/logs/service.log" 2>&1 &
echo $! > "$MODDIR/run/apm-daemon.pid"
