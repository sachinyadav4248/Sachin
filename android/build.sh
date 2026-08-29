#!/usr/bin/env bash
# Build the Android APK. Requires the .NET 8 SDK with the android workload, and an Android SDK.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/.." && pwd)"

if ! command -v dotnet >/dev/null 2>&1; then
    for candidate in "${DOTNET_ROOT:-}" /opt/dotnet "$HOME/.dotnet"; do
        if [ -n "$candidate" ] && [ -x "$candidate/dotnet" ]; then
            export PATH="$candidate:$PATH"
            break
        fi
    done
fi

if ! command -v dotnet >/dev/null 2>&1; then
    echo "dotnet not found. Install the .NET 8 SDK, then: dotnet workload install android" >&2
    exit 1
fi

: "${ANDROID_HOME:=/opt/android-sdk}"
export ANDROID_HOME
export ANDROID_SDK_ROOT="$ANDROID_HOME"

if [ ! -d "$ANDROID_HOME/platforms" ]; then
    echo "Android SDK not found at $ANDROID_HOME. Set ANDROID_HOME, or install it with:" >&2
    echo "  sdkmanager --install 'platform-tools' 'platforms;android-34' 'build-tools;34.0.0'" >&2
    exit 1
fi

export DOTNET_CLI_TELEMETRY_OPTOUT=1
export DOTNET_NOLOGO=1

configuration="${1:-Release}"

echo "==> Verifying the runtime first"
"$root/tools/verify/run.sh"

echo "==> Building the APK ($configuration)"
dotnet build "$here/SizzleStreet.Android/SizzleStreet.Android.csproj" -c "$configuration" -v q --nologo

version="$(grep -oP '(?<=<ApplicationDisplayVersion>)[^<]+' "$here/SizzleStreet.Android/SizzleStreet.Android.csproj")"
built="$here/SizzleStreet.Android/bin/$configuration/net8.0-android34.0/com.sizzlestreetgames.sizzlestreet-Signed.apk"

mkdir -p "$root/dist"
output="$root/dist/SizzleStreet-$version.apk"
cp "$built" "$output"

echo
echo "APK:    $output"
echo "Size:   $(du -h "$output" | cut -f1)"
echo "SHA256: $(sha256sum "$output" | cut -d' ' -f1)"
