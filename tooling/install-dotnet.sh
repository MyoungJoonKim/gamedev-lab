#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
tool_root="$(dirname "$repo_root")/.tools/dotnet"
if [[ "$(uname -s)" != Linux || "$(uname -m)" != x86_64 ]]; then
  echo 'Install .NET SDK 8+ for your platform from https://dotnet.microsoft.com/download' >&2
  exit 2
fi
sdk_version=8.0.427
sdk_sha512=85725692f465f5024b9b42a159a29d9f73e8c57ad9e8bfe1e7028a505d18031d68931e8aa3f9de44145b08170dde897c8a78e1aa18d4219698b6891af7095d39
if [[ ! -x "$tool_root/dotnet" ]] || [[ "$("$tool_root/dotnet" --version)" != "$sdk_version" ]]; then
  sdk_archive="$(mktemp /tmp/gamedev-dotnet.XXXXXX.tar.gz)"
  trap 'rm -f "$sdk_archive"' EXIT
  curl --fail --show-error --silent --location "https://builds.dotnet.microsoft.com/dotnet/Sdk/$sdk_version/dotnet-sdk-$sdk_version-linux-x64.tar.gz" -o "$sdk_archive"
  printf '%s  %s\n' "$sdk_sha512" "$sdk_archive" | sha512sum --check --status
  mkdir -p "$tool_root"
  tar -xzf "$sdk_archive" -C "$tool_root"
fi
"$tool_root/dotnet" --version
