#!/usr/bin/env bash
# Сборка debug-apk в WSL. Нужна, когда Java под Windows не может открыть loopback (VPN/фильтры):
# внутри WSL Gradle работает как обычно. JDK 21 и Android cmdline-tools лежат в ~/tools.
set -euo pipefail

SRC="${SRC:-$(cd "$(dirname "$0")/.." && pwd)}"
WORK="$HOME/build/kodeks"
export JAVA_HOME="$HOME/tools/jdk"
export ANDROID_HOME="$HOME/tools/android"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

yes | sdkmanager --licenses >/dev/null || true
sdkmanager "platforms;android-36" "build-tools;36.0.0" "platform-tools" >/dev/null

# Собираем на родной файловой системе WSL: на /mnt/c Gradle в разы медленнее.
rm -rf "$WORK"
mkdir -p "$WORK/node_modules"
cp -r "$SRC/android" "$WORK/android"
cp -r "$SRC/node_modules/@capacitor" "$WORK/node_modules/@capacitor"
rm -rf "$WORK/android/build" "$WORK/android/app/build" "$WORK/android/.gradle"
echo "sdk.dir=$ANDROID_HOME" > "$WORK/android/local.properties"

cd "$WORK/android"
chmod +x gradlew
./gradlew assembleDebug --no-daemon

mkdir -p "$SRC/out"
cp app/build/outputs/apk/debug/app-debug.apk "$SRC/out/kodeks-debug.apk"
ls -la "$SRC/out/kodeks-debug.apk"
