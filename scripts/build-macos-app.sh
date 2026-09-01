#!/bin/zsh

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="$PROJECT_DIR/build"
NATIVE_BUILD_DIR="/private/tmp/brainmax-native-build"
APP_DIR="$NATIVE_BUILD_DIR/Brainmax.app"
CONTENTS_DIR="$APP_DIR/Contents"
RESOURCES_DIR="$CONTENTS_DIR/Resources"
ICONSET_DIR="$BUILD_DIR/AppIcon.iconset"
MODULE_CACHE="$NATIVE_BUILD_DIR/swift-module-cache"

cd "$PROJECT_DIR"
npm run build
node "$PROJECT_DIR/scripts/make-native-html.mjs" "$PROJECT_DIR/dist" "$NATIVE_BUILD_DIR/native-index.html"

mkdir -p "$NATIVE_BUILD_DIR"

if [[ -e "$APP_DIR" ]]; then
  expected_app="/private/tmp/brainmax-native-build/Brainmax.app"
  if [[ "$APP_DIR" != "$expected_app" || ! -d "$APP_DIR" || -L "$APP_DIR" ]]; then
    echo "Refusing to replace an unexpected app path: $APP_DIR" >&2
    exit 1
  fi
  echo "Replacing the generated app at $APP_DIR"
  ls -ld "$APP_DIR"
  rm -rf -- "$APP_DIR"
fi

mkdir -p "$CONTENTS_DIR/MacOS" "$RESOURCES_DIR/app" "$ICONSET_DIR" "$MODULE_CACHE"

swiftc \
  -parse-as-library \
  -module-cache-path "$MODULE_CACHE" \
  "$PROJECT_DIR/macos/BrainmaxApp.swift" \
  -framework AppKit \
  -framework WebKit \
  -o "$CONTENTS_DIR/MacOS/Brainmax"

swiftc \
  -module-cache-path "$MODULE_CACHE" \
  "$PROJECT_DIR/macos/MakeIcon.swift" \
  -framework AppKit \
  -o "$BUILD_DIR/make-brainmax-icon"

swiftc \
  -module-cache-path "$MODULE_CACHE" \
  "$PROJECT_DIR/macos/MakeIcns.swift" \
  -o "$BUILD_DIR/make-brainmax-icns"

"$BUILD_DIR/make-brainmax-icon" "$BUILD_DIR/AppIcon-1024.png"

for specification in \
  "16 icon_16x16.png" \
  "32 icon_16x16@2x.png" \
  "32 icon_32x32.png" \
  "64 icon_32x32@2x.png" \
  "128 icon_128x128.png" \
  "256 icon_128x128@2x.png" \
  "256 icon_256x256.png" \
  "512 icon_256x256@2x.png" \
  "512 icon_512x512.png" \
  "1024 icon_512x512@2x.png"; do
  pixels="${specification%% *}"
  filename="${specification#* }"
  sips -z "$pixels" "$pixels" "$BUILD_DIR/AppIcon-1024.png" --out "$ICONSET_DIR/$filename" >/dev/null
done

"$BUILD_DIR/make-brainmax-icns" "$ICONSET_DIR" "$RESOURCES_DIR/AppIcon.icns"
cp "$PROJECT_DIR/macos/Info.plist" "$CONTENTS_DIR/Info.plist"
printf 'APPLBRMX' > "$CONTENTS_DIR/PkgInfo"
cp "$NATIVE_BUILD_DIR/native-index.html" "$RESOURCES_DIR/app/index.html"
codesign --force --deep --sign - "$APP_DIR"

echo "Built $APP_DIR"
