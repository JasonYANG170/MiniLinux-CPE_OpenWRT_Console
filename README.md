# MiniLinux-CPE OpenWRT Console

`yang-cpe-console` 是为 MiniLinux-CPE（MT7628、ImmortalWrt 25.12、
Linux 6.12）制作的设备控制软件。项目同时提供现代 LuCI 图形界面和
串口/SSH 命令行；后端只使用 BusyBox/ash 和 OpenWrt 原生工具，不依赖
Python、Node.js 或 ncurses。

## 功能

- 在 LuCI 的“服务 → MiniLinux CPE”页面查看状态并完成配置。
- 使用网页滑块设置 GPIO46 风扇 PWM，范围为 0–255。
- 显示 CPU 频率、负载、温度和运行时间。
- 显示内存、磁盘/TF 卡、USB 存储状态。
- 显示 MT7628 交换机端口、LAN/WAN 地址及无线状态。
- 检测 EC200 的 USB、AT、QMI/MBIM 设备。
- 查询 SIM、信号、注册状态、网络制式和 QMI/MBIM 连接状态。
- 配置 QMI/MBIM/NCM、APN、PIN、PDP、鉴权及自动/GSM/LTE 模式。
- 允许发送以 `AT` 开头的自定义 EC200 指令，并拒绝控制字符。

## 使用

```sh
cpectl
cpectl dashboard
cpectl fan status
cpectl fan 128
cpectl ec200 status
cpectl ec200 at 'AT+CSQ'
cpectl ec200 set apn cmnet
cpectl ec200 set proto qmi
cpectl ec200 set network_mode lte
cpectl ec200 apply
```

EC200 配置保存在 `/etc/config/ec200`。执行 `cpectl ec200 apply` 会更新
UCI 网络接口并重新连接，远程操作时可能暂时断网。

可配置键：`proto`、`at_port`、`data_device`、`interface`、`apn`、`pin`、
`pdptype`、`auth`、`username`、`password`、`network_mode`。

## 安装

ImmortalWrt 25.12 已改用 APK 包格式，不能安装传统 IPK。到仓库的
**Actions** 页面下载 `luci-app-yang-cpe-console-1.0.0-ramips-mt76x8`
artifact，把其中两个 APK 上传到设备后执行：

```sh
apk add --allow-untrusted /tmp/yang-cpe-console-1.0.0-r1.apk
apk add --allow-untrusted /tmp/luci-app-yang-cpe-console-*.apk
```

重新登录或刷新 LuCI 后，打开 **服务 → MiniLinux CPE**。图形界面包含
系统/磁盘/网口/无线状态区、风扇 PWM 滑块、EC200 配置表单、详细状态和
自定义 AT 指令输入框。

本软件包依赖 `ubus`、`uci`、`jsonfilter`、`iwinfo`、`swconfig`、
`block-mount`、`usbutils`、`uqmi` 和 `umbim`。目标固件还应包含 EC200
对应的 USB 串口、QMI/MBIM/NCM 内核驱动和 `fanctl`。

## CI 构建

GitHub Actions 固定使用：

- ImmortalWrt 分支：`openwrt-25.12`
- 源码提交：`3a0f609352e0b582fc670af865ad449a65b18e62`
- 目标：`ramips/mt76x8`、`hilink_hlk-7628n`

推送 `Makefile`、`ci.config`、`files/`、`luci-app/` 或工作流变更会自动构建；也可在
Actions 页面手动运行 **Build MiniLinux-CPE console APK**。
