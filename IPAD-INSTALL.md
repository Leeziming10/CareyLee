# iPad 安装与每周重签

## 1. 用 GitHub Actions 产出 IPA

1. 将本目录推到 GitHub 仓库。
2. 在仓库 Actions 页面手动运行 `build-ios`。
3. 完成后下载 `bar-pos-unsigned-ipa` 中的 `bar-pos-unsigned.ipa`。

IPA 未签名，原因是免费 Apple ID 的证书无法在 GitHub Actions 里可靠维护。用你自己的 Apple ID 在 Windows 上签名安装。

## 2. Windows 免费签名安装

推荐 AltStore/AltServer：

1. Windows 安装 [AltServer](https://altstore.io/)。
2. iPad 用数据线或同一 WiFi 连接到这台 Windows 电脑。
3. AltServer 安装 AltStore 到 iPad。
4. 在 AltStore 中通过“打开 IPA”安装本 App，登录免费 Apple ID。

也可以使用 Sideloadly：选择下载的 IPA，输入 Apple ID 后点 Start。

## 3. 7 天续签

免费 Apple ID 的签名每 7 天到期，这是 iPadOS 的强制限制，软件无法消除。到期前：

1. 保持 Windows 上 AltServer 运行。
2. 打开 iPad 上的 AltStore。
3. 对“吧台收银”执行 Refresh All。

也可把 Windows 开机自动启动 AltServer，并给 iPad 开启 AltStore 通知；收到过期提醒后刷新一次即可。
