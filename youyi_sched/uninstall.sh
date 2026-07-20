#!/system/bin/sh
MODDIR=${0%/*}

if [ -f "$MODDIR/run/apm-daemon.pid" ]; then
    kill "$(cat "$MODDIR/run/apm-daemon.pid")" 2>/dev/null
    rm -f "$MODDIR/run/apm-daemon.pid"
fi
pkill -f "apm-daemon" 2>/dev/null

sh "$MODDIR/bin/apm-ctl" restore 2>/dev/null
