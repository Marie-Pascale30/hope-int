// Construit l'application Android pour le site en production (HOPE_APP_URL, defaut dans capacitor.config.js).
//   npm run android:build              APK de test (android/app/build/outputs/apk/debug/)
//   npm run android:build -- --release AAB pour le Play Store (android/app/build/outputs/bundle/release/),
//                                      a signer avec la cle de l'organisation (voir apps/mobile/README.md)
const { execFileSync } = require("child_process");
const path = require("path");
const { androidEnv } = require("./env");

const release = process.argv.includes("--release");
const env = androidEnv();
const root = path.join(__dirname, "..");
const run = (cmd, args, cwd = root) => execFileSync(cmd, args, { stdio: "inherit", env, cwd, shell: process.platform === "win32" });

run("node", ["scripts/prepare-www.js"]);
run("npx", ["cap", "sync", "android"]);
run(process.platform === "win32" ? "gradlew.bat" : "./gradlew", [release ? "bundleRelease" : "assembleDebug"], path.join(root, "android"));
