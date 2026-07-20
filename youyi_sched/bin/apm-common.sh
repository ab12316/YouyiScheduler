#!/system/bin/sh
# 优易调度管理 - 公共函数库
MODDIR="${MODDIR:-$(cd "$(dirname "$0")/.." && pwd)}"

DEVICE_PROFILE=""
DEVICE_PROFILE_ID="unknown"
PROFILE_CONF=""

log_msg() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$MODDIR/logs/apm.log"
}

# 读取 ini 风格配置: section.key
ini_get() {
    local file="$1" section="$2" key="$3"
    awk -F= -v sec="[$section]" -v k="$key" '
        $0 == sec { found=1; next }
        /^\[/ { found=0 }
        found && $1 == k { gsub(/^[ \t]+|[ \t]+$/, "", $2); print $2; exit }
    ' "$file"
}

profile_get() {
    ini_get "$PROFILE_CONF" profile "$1"
}

device_get() {
    ini_get "$DEVICE_PROFILE" "$1" "$2"
}

load_device_profile() {
    local dev model soc match id
    dev=$(getprop ro.product.device)
    model=$(getprop ro.product.model)
    soc=$(getprop ro.soc.model)

    for f in "$MODDIR"/config/devices/*.conf; do
        [ -f "$f" ] || continue
        match=$(ini_get "$f" device match)
        id=$(ini_get "$f" device id)
        case ",$match," in
            *,"$dev",*|*,"$model",*|*,"$soc",*)
                DEVICE_PROFILE="$f"
                DEVICE_PROFILE_ID="$id"
                log_msg "matched device profile: $id ($f)"
                return 0
                ;;
        esac
    done

    DEVICE_PROFILE="$MODDIR/config/devices/sm8750_generic.conf"
    DEVICE_PROFILE_ID="sm8750_generic"
    log_msg "using fallback profile: sm8750_generic"
    return 0
}

load_profile() {
    local mode="$1"
    PROFILE_CONF="$MODDIR/config/profiles/${mode}.conf"
    if [ ! -f "$PROFILE_CONF" ]; then
        log_msg "profile not found: $mode"
        return 1
    fi
    return 0
}

# 备份 sysfs 原始值（仅首次）
backup_file() {
    local src="$1"
    local name dst
    name="state_backup_$(echo "$src" | tr '/' '_')"
    dst="$MODDIR/state_backup/$name"
    if [ ! -f "$dst" ] && [ -r "$src" ]; then
        cat "$src" > "$dst" 2>/dev/null
    fi
}

write_sysfs() {
    local path="$1" val="$2"
    if [ -w "$path" ] 2>/dev/null; then
        echo "$val" > "$path" 2>/dev/null && return 0
    fi
    return 1
}

get_mode_suffix() {
    case "$1" in
        eco) echo eco ;;
        balanced) echo balanced ;;
        performance) echo performance ;;
        gaming) echo gaming ;;
        beast) echo beast ;;
        *) echo balanced ;;
    esac
}

apply_cpu() {
    local mode="$1" suffix governor min0 min6 path0 path6
    suffix=$(get_mode_suffix "$mode")
    governor=$(profile_get cpu_governor)

    path0=$(device_get cpu.policy0 path)
    path6=$(device_get cpu.policy6 path)
    min0=$(device_get cpu.policy0 "min_${suffix}")
    min6=$(device_get cpu.policy6 "min_${suffix}")

    [ -z "$path0" ] && return
    backup_file "$path0/scaling_governor"
    backup_file "$path0/scaling_min_freq"
    backup_file "$path6/scaling_governor"
    backup_file "$path6/scaling_min_freq"

    if [ -n "$governor" ]; then
        write_sysfs "$path0/scaling_governor" "$governor"
        write_sysfs "$path6/scaling_governor" "$governor"
    fi

    if [ "$mode" != "eco" ] && [ "$mode" != "balanced" ]; then
        [ -n "$min0" ] && write_sysfs "$path0/scaling_min_freq" "$min0"
        [ -n "$min6" ] && write_sysfs "$path6/scaling_min_freq" "$min6"
    fi
}

apply_gpu() {
    local mode="$1" gpu_path min_pl max_pl min_freq suffix
    suffix=$(get_mode_suffix "$mode")
    gpu_path=$(device_get gpu path)
    [ -z "$gpu_path" ] && return

    backup_file "$gpu_path/min_pwrlevel"
    backup_file "$gpu_path/max_pwrlevel"
    backup_file "$gpu_path/devfreq/min_freq"

    case "$mode" in
        eco|balanced)
            ;;
        performance|gaming|beast)
            if [ "$mode" = "beast" ]; then
                min_pl=$(device_get gpu min_pwrlevel_beast)
                max_pl=$(device_get gpu max_pwrlevel_beast)
                min_freq=$(device_get gpu min_freq_beast)
            else
                min_freq=$(device_get gpu min_freq_gaming)
                min_pl=0
                max_pl=0
            fi
            [ -n "$min_pl" ] && write_sysfs "$gpu_path/min_pwrlevel" "$min_pl"
            [ -n "$max_pl" ] && write_sysfs "$gpu_path/max_pwrlevel" "$max_pl"
            [ -n "$min_freq" ] && write_sysfs "$gpu_path/devfreq/min_freq" "$min_freq"
            ;;
    esac
}

apply_thermal() {
    local mode="$1" zones trip_val zone trip_file
    zones=$(device_get thermal zones)
    [ -z "$zones" ] && return

    case "$mode" in
        beast) trip_val=$(device_get thermal trip_beast) ;;
        gaming|performance) trip_val=$(device_get thermal trip_gaming) ;;
        *) return 0 ;;
    esac
    [ -z "$trip_val" ] && return

  IFS=,
  for zone in $zones; do
        for trip_file in /sys/class/thermal/thermal_zone${zone}/trip_point_*_temp; do
            [ -f "$trip_file" ] || continue
            backup_file "$trip_file"
            write_sysfs "$trip_file" "$trip_val"
        done
    done
    IFS=' 	
'
}

stop_thermal_services() {
    local te horae
    te=$(device_get services thermal_engine)
    horae=$(device_get services horae)

  if pidof "$te" >/dev/null 2>&1; then
        killall -9 "$te" 2>/dev/null
        log_msg "stopped $te"
    fi
}

interfere_horae() {
    local horae
    horae=$(device_get services horae)
    # 持续重设温控参数，对抗 horae 写入
    apply_thermal "$1"
    apply_cpu "$1"
    apply_gpu "$1"
}

apply_mode() {
    local mode="$1"
    load_profile "$mode" || return 1

    log_msg "applying mode: $mode ($(profile_get name))"

    apply_cpu "$mode"
    apply_gpu "$mode"
    apply_thermal "$mode"

    if [ "$(profile_get stop_thermal_engine)" = "true" ]; then
        stop_thermal_services
    fi

    if [ "$(profile_get horae_interfere)" = "true" ]; then
        interfere_horae "$mode"
    fi

    echo "$mode" > "$MODDIR/run/current_applied_mode"
    return 0
}

restore_sysfs_file() {
    local src="$1"
    local bak="$MODDIR/state_backup/state_backup_$(echo "$src" | tr '/' '_')"
    if [ -f "$bak" ] && [ -w "$src" ] 2>/dev/null; then
        cat "$bak" > "$src" 2>/dev/null
    fi
}

restore_all() {
    local bak orig
    log_msg "restoring original sysfs values"
    for bak in "$MODDIR"/state_backup/state_backup_*; do
        [ -f "$bak" ] || continue
        orig="/$(basename "$bak" | sed 's/^state_backup_//' | tr '_' '/')"
        if [ -w "$orig" ] 2>/dev/null; then
            cat "$bak" > "$orig" 2>/dev/null
        fi
    done
    rm -f "$MODDIR/run/current_applied_mode"
    log_msg "restore complete"
}

get_status_json() {
    local mode path0 path6 gpu_path temp cpu0 cpu6 gpu
    mode=$(cat "$MODDIR/config/current_mode" 2>/dev/null | tr -d '[:space:]')
    path0=$(device_get cpu.policy0 path)
    path6=$(device_get cpu.policy6 path)
    gpu_path=$(device_get gpu path)

    cpu0=$(cat "$path0/scaling_governor" 2>/dev/null)
    cpu6=$(cat "$path6/scaling_governor" 2>/dev/null)
    gpu=$(cat "$gpu_path/min_pwrlevel" 2>/dev/null)
    temp=$(cat /sys/class/thermal/thermal_zone17/temp 2>/dev/null)

    printf '{"mode":"%s","device":"%s","cpu_governor_p0":"%s","cpu_governor_p6":"%s","gpu_min_pwrlevel":"%s","temp_zone17_mc":"%s","daemon":"%s"}' \
        "$mode" "$DEVICE_PROFILE_ID" "$cpu0" "$cpu6" "$gpu" "$temp" \
        "$(if [ -f "$MODDIR/run/apm-daemon.pid" ] && kill -0 "$(cat "$MODDIR/run/apm-daemon.pid")" 2>/dev/null; then cat "$MODDIR/run/apm-daemon.pid"; else echo stopped; fi)"
}
