# iPad 吧台收银

横屏 iPad 原生收银应用：桌台点单、会员储值与折扣、酒水管理、微信/支付宝静态收款码、局域网 58mm ESC/POS 小票打印。

## 本地开发

```bash
npm install
npm run dev
```

浏览器会以 `localhost:5173` 打开桌面预览；打印在网页模式下提供小票预览，不发送局域网指令。

## 原生 iOS

Windows 本机无法编译 iOS。仓库中的 GitHub Actions 工作流会在 macOS runner 上构建未签名 IPA：

详细步骤见 [IPAD-INSTALL.md](IPAD-INSTALL.md)。核心流程：

1. 推到 GitHub 并运行 Actions 中的 `build-ios` 工作流。
2. 下载未签名 `bar-pos-unsigned.ipa`。
3. 在 Windows 用 AltStore/AltServer 或 Sideloadly 用免费 Apple ID 签名安装。

免费 Apple ID 的签名有效期为 7 天；到期前在 AltStore 刷新。这是 iPadOS 的强制限制，无法通过软件消除。

## 真机确认

- 小票宽度选择 58mm。
- 打印机与 iPad 连接同一 WiFi。
- 在“设置 > 打印机”填写打印机 IP 与端口并测试打印。
