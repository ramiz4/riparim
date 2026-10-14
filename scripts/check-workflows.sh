#!/usr/bin/env bash
set -euo pipefail

actionlint_version='1.7.12'
case "$(uname -s):$(uname -m)" in
  Linux:x86_64)
    actionlint_platform='linux_amd64'
    actionlint_sha256='8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8'
    actionlint_checksum=(sha256sum)
    ;;
  Darwin:arm64)
    actionlint_platform='darwin_arm64'
    actionlint_sha256='aba9ced2dee8d27fecca3dc7feb1a7f9a52caefa1eb46f3271ea66b6e0e6953f'
    actionlint_checksum=(shasum -a 256)
    ;;
  *) printf '%s\n' 'Workflow lint supports Linux amd64 and macOS arm64.' >&2; exit 1 ;;
esac

actionlint_temp="${RUNNER_TEMP:-"$PWD/.agents/tmp"}"
mkdir -p "$actionlint_temp"
actionlint_directory="$(mktemp -d "$actionlint_temp/actionlint-XXXXXX")"
trap 'rm -rf -- "$actionlint_directory"' EXIT
actionlint_archive="$actionlint_directory/actionlint.tar.gz"
curl --fail --silent --show-error --location --connect-timeout 10 --max-time 60 \
  --output "$actionlint_archive" \
  "https://github.com/rhysd/actionlint/releases/download/v${actionlint_version}/actionlint_${actionlint_version}_${actionlint_platform}.tar.gz"
actionlint_actual_sha256="$("${actionlint_checksum[@]}" "$actionlint_archive")"
if [[ "${actionlint_actual_sha256%% *}" != "$actionlint_sha256" ]]; then
  printf '%s\n' 'Workflow lint download failed SHA-256 verification.' >&2
  exit 1
fi
tar -xzf "$actionlint_archive" -C "$actionlint_directory" actionlint
"$actionlint_directory/actionlint" -shellcheck= -pyflakes= .github/workflows/*.yml
