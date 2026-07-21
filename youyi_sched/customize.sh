#!/system/bin/sh
# APatch 模块安装脚本

ui_print "*******************************"
ui_print "  优易调度管理 v1.0.1"
ui_print "  Youyi Scheduler for APatch"
ui_print "*******************************"

if [ "$APATCH" != true ] && [ "$KERNELPATCH" != true ]; then
    abort "! 需要 APatch 环境"
fi

ui_print "- 设置权限..."
set_perm_recursive "$MODPATH" 0 0 0755 0644
set_perm_recursive "$MODPATH/bin" 0 0 0755 0700
set_perm "$MODPATH/service.sh" 0 0 0755
set_perm "$MODPATH/post-fs-data.sh" 0 0 0755
set_perm "$MODPATH/uninstall.sh" 0 0 0755

mkdir -p "$MODPATH/run" "$MODPATH/logs" "$MODPATH/state_backup"
chmod 0755 "$MODPATH/run" "$MODPATH/logs" "$MODPATH/state_backup"

ui_print "- 安装完成"
ui_print "  重启后在 APatch 管理器中打开 WebUI"
ui_print "  或执行: sh $MODPATH/bin/apm-ctl status"
