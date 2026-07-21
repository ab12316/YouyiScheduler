# 开发与适配文档

本文档面向开发者和贡献者，说明如何为新机型添加 Device Profile、打包模块及提交 PR。

---

## 模块 ID 与路径

| 项目 | 值 |
|------|-----|
| 模块 ID | `youyi_sched` |
| 安装路径 | `/data/adb/modules/youyi_sched/` |
| 打包产物 | `youyi_sched.zip` |

---

## 目录结构

```
youyi_sched/
├── module.prop              # 模块元信息（id 不可随意更改）
├── customize.sh             # 安装时执行
├── service.sh               # 开机 late_start 启动守护进程
├── post-fs-data.sh
├── uninstall.sh             # 卸载时恢复 sysfs
├── bin/
│   ├── apm-common.sh        # 核心逻辑库
│   ├── apm-daemon           # 守护进程
│   ├── apm-ctl              # CLI 控制
│   └── apm-probe            # 设备探测
├── config/
│   ├── current_mode         # 当前档位（运行时写入）
│   ├── profiles/            # 五档策略定义
│   │   ├── eco.conf
│   │   ├── balanced.conf
│   │   ├── performance.conf
│   │   ├── gaming.conf
│   │   └── beast.conf
│   └── devices/             # 机型硬件参数
│       ├── oneplus_13t.conf
│       └── sm8750_generic.conf
└── webroot/                 # WebUI
    ├── index.html
    ├── style.css
    └── app.js
```

---

## 打包

```bash
chmod +x build.sh
./build.sh
```

生成 `youyi_sched.zip`，在 APatch 中刷入测试。

---

## 新机型适配流程

### 1. 探测设备

在目标手机上（已 Root + 模块已安装）：

```bash
sh /data/adb/modules/youyi_sched/bin/apm-probe
cat /data/adb/modules/youyi_sched/config/probed.json
```

### 2. 收集关键信息

```bash
getprop ro.product.device ro.product.model ro.soc.model ro.board.platform

# CPU
ls /sys/devices/system/cpu/cpufreq/
cat /sys/devices/system/cpu/cpufreq/policy*/scaling_available_governors
cat /sys/devices/system/cpu/cpufreq/policy*/cpuinfo_max_freq

# GPU
cat /sys/class/kgsl/kgsl-3d0/gpu_available_frequencies
cat /sys/class/kgsl/kgsl-3d0/min_pwrlevel

# 温控服务
pidof horae thermal-engine-v2
```

### 3. 编写 Device Profile

在 `config/devices/` 新建 `your_device.conf`：

```ini
[device]
id=your_device_id
match=DEVICE_CODENAME,MODEL_NAME,SM8750
soc=SM8750
platform=sun

[cpu.policy0]
path=/sys/devices/system/cpu/cpufreq/policy0
max_freq=3532800
min_eco=556800
min_balanced=1209600
min_performance=2000000
min_gaming=2918400
min_beast=3321600

[cpu.policy6]
path=/sys/devices/system/cpu/cpufreq/policy6
max_freq=4320000
min_eco=1017600
min_balanced=2000000
min_performance=3500000
min_gaming=4089600
min_beast=4320000

[gpu]
path=/sys/class/kgsl/kgsl-3d0
min_pwrlevel_beast=0
max_pwrlevel_beast=0
min_freq_gaming=734000000
min_freq_beast=990000000

[thermal]
zones=1,3,13,17,21,32,36
trip_beast=125000
trip_gaming=115000

[services]
horae=/system_ext/bin/horae
thermal_engine=thermal-engine-v2
```

`match` 字段支持逗号分隔，匹配 `ro.product.device`、`ro.product.model` 或 `ro.soc.model`。

### 4. 测试

```bash
sh /data/adb/modules/youyi_sched/bin/apm-ctl set gaming
sh /data/adb/modules/youyi_sched/bin/apm-ctl status
```

### 5. 提交 PR

- 附上机型、系统版本、SoC
- 提交 `config/devices/your_device.conf`
- 说明测试结果（可选附上 probed.json）

---

## Profile 配置说明

### profiles/*.conf

```ini
[profile]
id=gaming
name=电竞模式
level=3
cpu_governor=performance    # CPU 调度器
gpu_boost=true              # 是否提升 GPU
thermal_relax=10000         # 温控放宽程度（beast 用 99999）
stop_thermal_engine=false   # 是否停止 thermal-engine
horae_interfere=true        # 是否对抗 horae 回写
persist_interval=8          # 守护进程重刷间隔（秒）
no_thermal_limit=true       # 仅 beast：无温控限制
```

### 匹配优先级

`apm-common.sh` 按 `config/devices/*.conf` 文件名顺序扫描，`match` 命中即用。未命中则 fallback 到 `sm8750_generic.conf`。

---

## WebUI 开发

- 兼容 APatch / KernelSU WebUI API
- 使用 `kernelsu` npm 包的 `exec()` 执行 Root 命令
- **不要使用** `confirm()` / `alert()`，WebView 不支持
- `MODDIR` 硬编码为 `/data/adb/modules/youyi_sched`

本地调试需将 `webroot/` 推送到手机：

```bash
adb push youyi_sched/webroot/ /data/local/tmp/
adb shell su -c 'cp -r /data/local/tmp/webroot/* /data/adb/modules/youyi_sched/webroot/'
```

---

## 提交规范

- Commit 信息使用中文或英文均可，需清晰描述改动
- 新机型 Profile 单独 commit
- 不要提交 `logs/`、`state_backup/`、`probed.json`（已在 .gitignore）

---

## 待办 / Roadmap

- [ ] horae LD_PRELOAD 原生 Hook
- [ ] KPM 内核级温控伪造
- [ ] WebUI 离线化（内置 kernelsu.js）
- [ ] 游戏前台自动切档
- [ ] 天玑平台适配
