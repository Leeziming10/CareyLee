import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.barpos.local",
  appName: "吧台收银",
  webDir: "dist",
  backgroundColor: "#0f1115",
  ios: {
    contentInset: "automatic"
  }
};

export default config;
