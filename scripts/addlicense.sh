#!/usr/bin/env bash
# Checks (default) or adds Apache license headers on tracked .ts/.js files
# using google/addlicense. Usage: scripts/addlicense.sh [check|fix]
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v addlicense >/dev/null; then
  echo "addlicense not found. Install: go install github.com/google/addlicense@v1.2.0" >&2
  exit 1
fi

mode="${1:-check}"
flags=(-f license-header.tmpl)
if [ "$mode" = "check" ]; then flags+=(-check); fi

git ls-files -- '*.ts' '*.js' \
  | grep -vE '(^|/)(node_modules|lib|dist|coverage)/' \
  | xargs addlicense "${flags[@]}"
