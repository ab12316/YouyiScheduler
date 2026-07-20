#!/system/bin/sh
MODDIR=${0%/*}
sh "$MODDIR/bin/apm-ctl" reload
