#!/usr/bin/env bash
set -euo pipefail

shopt -s nullglob

FILES=(
  "README.md"
  "AGENTS.md"
  "workshop-cloudflare-agent-spec.md"
  "docs/"*.md
)

fail=0

echo "Checking slug-only route contract in docs..."

while IFS= read -r hit; do
  [[ -z "${hit}" ]] && continue

  file="${hit%%:*}"
  rest="${hit#*:}"
  line="${rest%%:*}"
  text="${rest#*:}"

  if ! echo "${text}" | grep -Eiq '404|not found|not supported|must return|returns markdown 404|返回 markdown 404|不可访问|禁止|never document|must be explicitly'; then
    echo "Id placeholder route must be explicit negative case: ${file}:${line}:${text}"
    fail=1
  fi
done < <(grep -nE '/wiki/articles/:id(\.md)?|GET[[:space:]]+/wiki/articles/:id(\.md)?' "${FILES[@]}" || true)

while IFS= read -r hit; do
  [[ -z "${hit}" ]] && continue

  file="${hit%%:*}"
  rest="${hit#*:}"
  line="${rest%%:*}"
  text="${rest#*:}"

  if ! echo "${text}" | grep -Eiq '404|not found|not supported|must return|returns markdown 404|返回 markdown 404|不可访问|禁止'; then
    echo "Numeric article route mention must be explicit 404 case: ${file}:${line}:${text}"
    fail=1
  fi
done < <(grep -nE '/wiki/articles/[0-9]+(\.md)?' "${FILES[@]}" || true)

if [[ "${fail}" -ne 0 ]]; then
  echo "Slug-only docs check failed."
  exit 1
fi

echo "Slug-only docs check passed."
