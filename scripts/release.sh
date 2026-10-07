#!/usr/bin/env bash
# Release pocket-pet: bump the version in plugin.json, commit, tag, push and
# create a GitHub release. Users get it with /plugin update; nothing goes to npm.
#
#   scripts/release.sh patch|minor|major|<x.y.z> [--dry-run]
set -euo pipefail

cd "$(dirname "$0")/.."
MANIFEST=.claude-plugin/plugin.json

arg=${1:-}
dry=false
[[ ${2:-} == --dry-run ]] && dry=true
[[ -n $arg ]] || { echo "usage: scripts/release.sh patch|minor|major|<x.y.z> [--dry-run]" >&2; exit 1; }

current=$(jq -r .version "$MANIFEST")
IFS=. read -r major minor patch <<<"$current"
case $arg in
  patch) next="$major.$minor.$((patch + 1))" ;;
  minor) next="$major.$((minor + 1)).0" ;;
  major) next="$((major + 1)).0.0" ;;
  *) [[ $arg =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "not a version: $arg" >&2; exit 1; }; next=$arg ;;
esac
tag="v$next"

[[ -z $(git status --porcelain) ]] || { echo "working tree is not clean; commit or stash first" >&2; exit 1; }
[[ $(git branch --show-current) == main ]] || { echo "release from main" >&2; exit 1; }
git fetch -q origin main
[[ $(git rev-parse HEAD) == "$(git rev-parse origin/main)" ]] || { echo "main is not in sync with origin/main" >&2; exit 1; }
! git rev-parse -q --verify "refs/tags/$tag" >/dev/null || { echo "tag $tag already exists" >&2; exit 1; }

echo "release $current -> $next ($tag)"
claude plugin validate . >/dev/null
claude plugin test .

$dry && { echo "dry run: stopping before any change"; exit 0; }

jq --arg v "$next" '.version = $v' "$MANIFEST" >"$MANIFEST.tmp" && mv "$MANIFEST.tmp" "$MANIFEST"
git add "$MANIFEST"
git commit -q -m "Release $tag"
git tag -a "$tag" -m "$tag"
git push origin main "$tag"

notes=$(git log --pretty='- %s' "$(git describe --tags --abbrev=0 "$tag^" 2>/dev/null || git rev-list --max-parents=0 HEAD)..$tag^")
gh release create "$tag" --title "$tag" --notes "${notes:-Release $tag}"
echo "released $tag. Users update with: /plugin update pocket-pet"
