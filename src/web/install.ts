import { installWebBridge } from "./bridge";

installWebBridge();

void import("@capacitor/splash-screen")
  .then(({ SplashScreen }) => SplashScreen.hide())
  .catch(() => {});

void import("@capacitor/status-bar")
  .then(({ StatusBar, Style }) => StatusBar.setStyle({ style: Style.Dark }))
  .catch(() => {});
