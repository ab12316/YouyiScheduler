# 优易调度管理

> Youyi Scheduler — 面向 APatch 的 Android 自适应性能调度模块

**仓库地址**：https://github.com/ab12316/youyi-sched

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![APatch](https://img.shields.io/badge/APatch-Module-green.svg)](https://apatch.dev/)
[![Platform](https://img.shields.io/badge/Platform-Android%2010%2B-orange.svg)](https://apatch.dev/)

优易调度管理是一个 **APatch（APM）模块**，通过调整 CPU/GPU 调度策略与温控参数，在手机上提供多档位性能管理。支持 **WebUI 可视化切换**，关闭 APatch 后台后依然生效。

## 功能特性

- 五档性能模式：省电 / 均衡 / 性能 / 电竞 / 满血
- APatch WebUI 图形界面，带动画与主题色切换
- 开机自动启动守护进程，持续维持当前档位
- 设备 Profile 自动匹配，支持多机型扩展
- 命令行工具 `apm-ctl` 完整控制
- 卸载时自动恢复原厂 sysfs 设置

## 支持设备

| 状态 | 机型 | SoC |
|------|------|-----|
| ✅ 已适配 | 一加 13T (PKX110) | 骁龙 8 至尊版 SM8750 |
| ✅ 通用 | 骁龙 8 至尊版机型 | SM8750 |
| 🔄 待社区贡献 | 其他 ColorOS / 高通机型 | — |

> 新机型可通过 `apm-probe` 探测后提交 Device Profile，详见 [开发文档](docs/DEVELOP.md)。

## 环境要求

- 已 Root，且安装 **APatch**（建议 KernelPatch ≥ 0.12）
- Android 10 (API 29) 及以上
- 高通骁龙平台（天玑平台需单独适配）

## 快速安装

### 方式一：刷入 ZIP（推荐）

1. 在 [Releases](https://github.com/ab12316/youyi-sched/releases) 页面下载 `youyi_sched.zip`
2. 打开 **APatch 管理器** → 模块 → 从本地安装
3. 选择 zip 文件，安装完成后 **重启手机**
4. 重启后在模块列表点击 **WebUI** 进行配置

### 方式二：自行打包

```bash
git clone https://github.com/ab12316/youyi-sched.git
cd youyi-sched
chmod +x build.sh
./build.sh
# 生成 youyi_sched.zip
```

## 快速使用

### WebUI（推荐）

1. APatch 管理器 → **优易调度管理** → **WebUI**
2. 点击档位卡片切换模式
3. 满血模式需二次确认

### 命令行

```bash
# 切换档位
sh /data/adb/modules/youyi_sched/bin/apm-ctl set gaming

# 查看状态（JSON）
sh /data/adb/modules/youyi_sched/bin/apm-ctl status

# 重新应用当前档位
sh /data/adb/modules/youyi_sched/bin/apm-ctl reload

# 恢复原厂设置
sh /data/adb/modules/youyi_sched/bin/apm-ctl restore
```

完整说明见 **[使用文档](docs/USAGE.md)**。

## 性能档位

| 档位 | ID | 说明 |
|------|-----|------|
| 省电 | `eco` | schedutil 调度，最低功耗 |
| 均衡 | `balanced` | 日常默认平衡 |
| 性能 | `performance` | 提升 CPU/GPU 下限 |
| 电竞 | `gaming` | performance + 温控放宽 |
| 满血 | `beast` | 无温控限制，极限性能 |

## 项目结构

```
youyi-sched/
├── youyi_sched/          # APatch 模块主体
│   ├── module.prop       # 模块元信息
│   ├── bin/              # apm-daemon / apm-ctl / apm-probe
│   ├── config/           # 档位与设备配置
│   ├── webroot/          # WebUI 界面
│   ├── service.sh        # 开机启动脚本
│   └── customize.sh      # 安装脚本
├── docs/
│   ├── USAGE.md          # 使用文档
│   └── DEVELOP.md        # 开发与适配文档
├── build.sh              # 打包脚本
└── README.md
```

## 免责声明

本模块通过修改系统调度与温控参数提升性能，**满血模式**可能导致设备严重发热、续航下降或硬件损伤。使用本模块即表示你已了解相关风险并自行承担后果。作者不对任何设备损坏、数据丢失或保修失效负责。

## 开源协议

本项目基于 [GPL-3.0](LICENSE) 开源。

## 致谢

- [APatch](https://github.com/bmax121/APatch) / [KernelPatch](https://github.com/bmax121/KernelPatch) 模块机制
- [KernelSU](https://kernelsu.org/) WebUI API 设计

## 贡献

欢迎提交 Issue 和 Pull Request，尤其是新机型的 Device Profile。详见 [开发文档](docs/DEVELOP.md)。
