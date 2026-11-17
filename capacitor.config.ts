import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.NYX_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: "com.nyx.player.ios",
  appName: "Nyx",
  webDir: "dist",
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: false,
        },
      }
    : {}),
  ios: {
    contentInset: "always",
    backgroundColor: "#000000",
    allowsLinkPreview: false,
    scheme: "NYX",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: "#000000",
      showSpinner: false,
    },
    StatusBar: {
      overlaysWebView: false,
      style: "DARK",
    },
  },
};

export default config;
