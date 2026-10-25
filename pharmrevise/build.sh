#!/usr/bin/env bash
# Builds a signed PharmRevise APK without Gradle, using the Debian/Ubuntu Android tools:
#   apt-get install aapt apksigner android-sdk-platform-23 dalvik-exchange zipalign
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
ANDROID_JAR="${ANDROID_JAR:-/usr/lib/android-sdk/platforms/android-23/android.jar}"
OUT="$ROOT/build"
KEYSTORE="${KEYSTORE:-$ROOT/keystore/pharmrevise.jks}"
APK_NAME="PharmRevise-TZ-v$(grep -o 'versionName="[^"]*"' "$ROOT/android/AndroidManifest.xml" | cut -d'"' -f2).apk"

rm -rf "$OUT" && mkdir -p "$OUT/gen" "$OUT/classes" "$OUT/assets/www"

python3 "$ROOT/tools/make_icons.py" "$ROOT/android/res"
python3 "$ROOT/tools/build_data.py"
cp -r "$ROOT/app/." "$OUT/assets/www/"

aapt package -f -m -J "$OUT/gen" -M "$ROOT/android/AndroidManifest.xml" \
  -S "$ROOT/android/res" -I "$ANDROID_JAR"

javac -source 8 -target 8 -bootclasspath "$ANDROID_JAR" -classpath "$ANDROID_JAR" \
  -d "$OUT/classes" -Xlint:-options \
  $(find "$ROOT/android/src" "$OUT/gen" -name '*.java')

dalvik-exchange --dex --output="$OUT/classes.dex" "$OUT/classes"

aapt package -f -M "$ROOT/android/AndroidManifest.xml" -S "$ROOT/android/res" \
  -A "$OUT/assets" -I "$ANDROID_JAR" -F "$OUT/unsigned.apk"
(cd "$OUT" && aapt add unsigned.apk classes.dex >/dev/null)

zipalign -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

if [ ! -f "$KEYSTORE" ]; then
  mkdir -p "$(dirname "$KEYSTORE")"
  keytool -genkeypair -keystore "$KEYSTORE" -alias pharmrevise -keyalg RSA -keysize 2048 \
    -validity 10000 -storepass pharmrevise -keypass pharmrevise \
    -dname "CN=PharmRevise TZ, O=PharmRevise, C=TZ"
fi
apksigner sign --ks "$KEYSTORE" --ks-pass pass:pharmrevise --key-pass pass:pharmrevise \
  --out "$OUT/$APK_NAME" "$OUT/aligned.apk"
apksigner verify --verbose "$OUT/$APK_NAME" | head -4
echo "Built $OUT/$APK_NAME ($(du -h "$OUT/$APK_NAME" | cut -f1))"
