# 使用文档

本文档介绍 **优易调度管理** 模块的安装、日常使用、命令行操作与常见问题。

---

## 目录

- [安装](#安装)
- [WebUI 使用](#webui-使用)
- [命令行使用](#命令行使用)
- [性能档位详解](#性能档位详解)
- [后台与游戏](#后台与游戏)
- [卸载与恢复](#卸载与恢复)
- [常见问题](#常见问题)

---

## 安装

### 前提条件

1. 手机已 Root，并安装 **APatch**
2. APatch 正常工作（可执行 `su`）
3. 建议 KernelPatch 版本 ≥ 0.12

### 安装步骤

1. 下载 `youyi_sched.zip`（Release 页面或自行 `./build.sh` 打包）
2. 打开 **APatch 管理器**
3. 进入 **模块** → **从本地安装** / **刷入**
4. 选择 `youyi_sched.zip`
5. **重启手机**（必须）

### 验证安装成功

重启后执行（可用终端模拟器或 `adb shell`）：

```bash
su
sh /data/adb/modules/youyi_sched/bin/apm-ctl status
```

若输出类似以下 JSON，说明安装成功：

```json
{"mode":"balanced","device":"oneplus_13t","cpu_governor_p0":"walt",...}
```

### 从旧版迁移

若你曾安装过 `oplus_apm`（一加满血 APM）：

1. 在 APatch 中 **卸载旧模块** 并重启
2. 再安装 `youyi_sched.zip` 并重启

> 两个模块不要同时安装，会冲突。

---

## WebUI 使用

1. 打开 **APatch 管理器**
2. 在模块列表找到 **优易调度管理**
3. 点击 **WebUI** 按钮

### 界面说明

| 区域 | 功能 |
|------|------|
| 顶部状态卡 | 当前档位、性能条 L0–L4、CPU/GPU/温度 |
| 档位列表 | 点击切换五种模式 |
| 底部按钮 | 重新应用 / 恢复原厂 / 探测设备 |

### 切换档位

1. 在档位列表中点击目标模式
2. 等待切换动画完成
3. 顶部状态应同步更新

**满血模式** 会弹出红色确认框，需点击「确认开启满血」。

### WebUI 无法加载？

WebUI 需要联网加载 JavaScript 库（`kernelsu` npm 包）。若离线无法使用，请改用命令行 `apm-ctl`。

---

## 命令行使用

模块安装路径：`/data/adb/modules/youyi_sched/`

### 切换档位

```bash
sh /data/adb/modules/youyi_sched/bin/apm-ctl set <档位>
```

档位 ID：`eco` | `balanced` | `performance` | `gaming` | `beast`

示例：

```bash
# 电竞模式
sh /data/adb/modules/youyi_sched/bin/apm-ctl set gaming

# 满血模式
sh /data/adb/modules/youyi_sched/bin/apm-ctl set beast
```

### 查看当前档位

```bash
sh /data/adb/modules/youyi_sched/bin/apm-ctl get
```

### 查看详细状态（JSON）

```bash
sh /data/adb/modules/youyi_sched/bin/apm-ctl status
```

### 重新应用当前档位

当感觉设置被系统改回时：

```bash
sh /data/adb/modules/youyi_sched/bin/apm-ctl reload
```

或在 WebUI 点击「重新应用」。

### 恢复原厂设置

```bash
sh /data/adb/modules/youyi_sched/bin/apm-ctl restore
```

### 探测设备节点

用于新机型适配，生成 `config/probed.json`：

```bash
sh /data/adb/modules/youyi_sched/bin/apm-probe
```

### 守护进程管理

```bash
# 启动
sh /data/adb/modules/youyi_sched/bin/apm-ctl start

# 停止
sh /data/adb/modules/youyi_sched/bin/apm-ctl stop
```

---

## 性能档位详解

| 档位 | 等级 | CPU | GPU | 温控 | 适用场景 |
|------|------|-----|-----|------|----------|
| 省电 | L0 | schedutil | 默认 | 跟随系统 | 续航优先 |
| 均衡 | L1 | walt | 默认 | 跟随系统 | 日常使用 |
| 性能 | L2 | walt + 高 min_freq | 提升下限 | 轻度放宽 | 轻度游戏 |
| 电竞 | L3 | performance | performance | 大幅放宽 | 竞技游戏 |
| 满血 | L4 | performance 锁频 | 最高档 | 解除限制 | 极限帧率 |

### 满血模式说明

- 停止 `thermal-engine-v2` 温控服务
- 将 thermal trip point 提升至 125°C
- 守护进程每 3 秒重刷设置，对抗系统回写
- **无硬件温度保护**，请自行承担发热风险
- 建议配合散热背夹使用

---

## 后台与游戏

### 关掉 APatch 后台还有效吗？

**有效。** 模块由独立守护进程 `apm-daemon` 维护，不依赖 APatch 前台运行。

流程：

1. 在 WebUI 或命令行切好档位
2. 划掉 APatch 后台
3. 直接启动游戏

### 推荐游戏前设置

| 游戏类型 | 推荐档位 |
|----------|----------|
| 休闲 / 卡牌 | 均衡 |
| 王者 / 吃鸡 | 电竞 |
| 原神 / 重度 3D | 满血（注意散热） |

---

## 卸载与恢复

### 正常卸载

1. APatch 管理器 → 模块 → **优易调度管理** → 卸载
2. **重启手机**

卸载脚本会自动恢复 CPU/GPU/温控 sysfs 到安装前备份值。

### 临时禁用

在模块目录创建空文件（需 Root）：

```bash
touch /data/adb/modules/youyi_sched/disable
reboot
```

删除 `disable` 文件并重启可重新启用。

---

## 常见问题

### Q: 切换档位后没感觉变化？

省电 / 均衡档变化较 subtle。请切换到电竞或满血模式，并用以下命令确认：

```bash
cat /sys/devices/system/cpu/cpufreq/policy*/scaling_governor
```

电竞 / 满血应显示 `performance`。

### Q: WebUI 顶部 L 等级不更新？

关闭 WebUI 重新打开，或点击「重新应用」。确保使用最新版 `app.js`。

### Q: 满血模式在 WebUI 点不了？

WebView 不支持系统 `confirm()` 弹窗。请更新到最新版（已改用自定义确认框），或直接用命令行 `apm-ctl set beast`。

### Q: 重启后失效？

检查模块是否被禁用：

```bash
ls /data/adb/modules/youyi_sched/disable
```

若存在则模块被关闭。同时确认守护进程：

```bash
sh /data/adb/modules/youyi_sched/bin/apm-ctl status
# daemon 字段应为 PID 数字，不是 stopped
```

### Q: 日志在哪里？

```bash
cat /data/adb/modules/youyi_sched/logs/apm.log
```

---

## 快捷指令备忘

```bash
MOD=/data/adb/modules/youyi_sched/bin/apm-ctl

$MOD set gaming      # 电竞
$MOD set beast       # 满血
$MOD set eco          # 省电
$MOD status          # 状态
$MOD reload          # 重刷
$MOD restore         # 恢复原厂
```
