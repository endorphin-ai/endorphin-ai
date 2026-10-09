#!/usr/bin/env bash
#
# Sync documentation from dev repo to public repo (endorphin-ai/endorphin-ai)
#
# Usage:
#   bash scripts/sync-public-docs.sh [version]
#
# If version is not provided, reads from package.json.
# Requires: gh CLI authenticated with access to both repos.
#
set -euo pipefail

# --- Configuration ---
DEV_REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PUBLIC_REPO="endorphin-ai/endorphin-ai"
PUBLIC_BRANCH="develop"
VERSION="${1:-$(node -p "require('${DEV_REPO_ROOT}/package.json').version")}"
SYNC_BRANCH="sync/docs-v${VERSION}"

echo "=== Endorphin AI Documentation Sync ==="
echo "Version: ${VERSION}"
echo "Public repo: ${PUBLIC_REPO} (branch: ${PUBLIC_BRANCH})"
echo ""

# --- Clone public repo ---
WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

echo "Cloning ${PUBLIC_REPO}..."
gh repo clone "${PUBLIC_REPO}" "${WORK_DIR}/public" -- --branch "${PUBLIC_BRANCH}" --depth 1
cd "${WORK_DIR}/public"
git checkout -b "${SYNC_BRANCH}"

# --- Sync root files ---
echo "Syncing root files..."
cp "${DEV_REPO_ROOT}/README.md" ./README.md
cp "${DEV_REPO_ROOT}/TRADEMARK.md" ./TRADEMARK.md

# --- Sync doc/ directories ---
echo "Syncing doc/ directories..."
mkdir -p doc/user-guide doc/images doc/video

# User guides (with --delete to remove stale files)
rsync -av --delete "${DEV_REPO_ROOT}/docs/project-manual/user-guide/" ./doc/user-guide/

# Images
rsync -av --delete "${DEV_REPO_ROOT}/docs/project-manual/images/" ./doc/images/

# Videos
rsync -av --delete "${DEV_REPO_ROOT}/docs/project-manual/video/" ./doc/video/

# Languages (sync each locale, clean up removed locales)
for lang_dir in "${DEV_REPO_ROOT}"/docs/project-manual/languages/*/; do
  lang=$(basename "$lang_dir")
  mkdir -p "doc/languages/${lang}"
  rsync -av --delete "${lang_dir}" "./doc/languages/${lang}/"
done
# Remove locales that no longer exist in dev repo
if [ -d "./doc/languages" ]; then
  for target_lang_dir in ./doc/languages/*/; do
    [ ! -d "$target_lang_dir" ] && continue
    lang=$(basename "$target_lang_dir")
    if [ ! -d "${DEV_REPO_ROOT}/docs/project-manual/languages/${lang}" ]; then
      echo "Removing stale locale: ${lang}"
      rm -rf "$target_lang_dir"
    fi
  done
fi

# --- Sync standalone doc files ---
echo "Syncing standalone docs..."
cp "${DEV_REPO_ROOT}/docs/project-manual/CI-TROUBLESHOOTING.md" ./doc/CI-TROUBLESHOOTING.md
cp "${DEV_REPO_ROOT}/docs/project-manual/NODEJS-COMPATIBILITY.md" ./doc/NODEJS-COMPATIBILITY.md
cp "${DEV_REPO_ROOT}/docs/plan/Changelog.md" ./doc/Changelog.md
cp "${DEV_REPO_ROOT}/docs/plan/ROADMAP.md" ./doc/ROADMAP.md

# --- Sync public-facing docs README ---
echo "Syncing doc/README.md (public version)..."
cp "${DEV_REPO_ROOT}/docs/project-manual/README-public.md" ./doc/README.md

# --- Write sync manifest ---
cat > ./doc/.sync-manifest.json <<MANIFEST
{
  "syncedFrom": "endorphin-ai/endorphin-ai-dev",
  "version": "${VERSION}",
  "syncedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "generator": "scripts/sync-public-docs.sh"
}
MANIFEST

# --- Commit and create PR ---
echo ""
echo "Staging changes..."
git add README.md TRADEMARK.md doc/

# Check if there are actual changes
if git diff --cached --quiet; then
  echo "No documentation changes to sync. Public repo is up to date."
  exit 0
fi

echo ""
echo "Changes detected:"
git diff --cached --stat
echo ""

git commit -m "$(cat <<EOF
docs: sync documentation from dev repo v${VERSION}

Automated documentation sync from endorphin-ai-dev.
Source version: ${VERSION}
EOF
)"

echo "Pushing branch ${SYNC_BRANCH}..."
git push origin "${SYNC_BRANCH}"

echo "Creating PR..."
PR_URL=$(gh pr create \
  --repo "${PUBLIC_REPO}" \
  --base "${PUBLIC_BRANCH}" \
  --head "${SYNC_BRANCH}" \
  --title "docs: sync documentation v${VERSION}" \
  --body "$(cat <<EOF
## Documentation Sync

Automated sync from \`endorphin-ai/endorphin-ai-dev\` version **${VERSION}**.

### Changes
\`\`\`
$(git diff --stat HEAD~1)
\`\`\`

### Checklist
- [ ] Review synced files for any internal content leakage
- [ ] Verify \`examples\` submodule is untouched
- [ ] Check all relative links resolve correctly

---
*Automated by sync-public-docs.sh*
EOF
)")

echo ""
echo "=== Sync complete ==="
echo "PR: ${PR_URL}"
