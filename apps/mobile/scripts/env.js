// Outils Android partages par les scripts : Java d'Android Studio et SDK, si non configures.
const fs = require("fs");
const path = require("path");

const STUDIO_JBR = ["C:/Program Files/Android/Android Studio/jbr", "/Applications/Android Studio.app/Contents/jbr/Contents/Home"];
const SDK = [
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Android", "Sdk"),
  process.env.HOME && path.join(process.env.HOME, "Library", "Android", "sdk"),
];

function androidEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  if (!env.JAVA_HOME) env.JAVA_HOME = STUDIO_JBR.find((dir) => fs.existsSync(dir));
  const sdk = SDK.find((dir) => dir && fs.existsSync(dir));
  if (sdk) env.ANDROID_HOME = env.ANDROID_SDK_ROOT = sdk;
  if (!env.JAVA_HOME) throw new Error("Java introuvable : installez Android Studio ou definissez JAVA_HOME.");
  return env;
}

const adb = (env) => path.join(env.ANDROID_HOME, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb");

module.exports = { androidEnv, adb };
