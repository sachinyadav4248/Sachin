#!/usr/bin/env bash
# Compile and test the game's runtime code without Unity.
#
# Set DOTNET_ROOT if the SDK lives somewhere other than the two paths tried below.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v dotnet >/dev/null 2>&1; then
    for candidate in "${DOTNET_ROOT:-}" /opt/dotnet "$HOME/.dotnet"; do
        if [ -n "$candidate" ] && [ -x "$candidate/dotnet" ]; then
            export PATH="$candidate:$PATH"
            break
        fi
    done
fi

if ! command -v dotnet >/dev/null 2>&1; then
    echo "dotnet not found. Install the .NET 8 SDK:" >&2
    echo "  curl -sSL https://dot.net/v1/dotnet-install.sh | bash -s -- --channel 8.0" >&2
    exit 1
fi

export DOTNET_CLI_TELEMETRY_OPTOUT=1
export DOTNET_NOLOGO=1

echo "==> Building runtime assemblies (netstandard2.1, as Unity does)"
dotnet build "$here/Runtime/SizzleStreet.Runtime.csproj" -v q --nologo

echo "==> Running edit-mode tests"
dotnet test "$here/Tests/SizzleStreet.Tests.csproj" -v q --nologo
