#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ./scripts/release.sh bump <patch|minor|major>
  ./scripts/release.sh bump auto
  ./scripts/release.sh determine-bump
  ./scripts/release.sh publish [--dry-run] [--tag <tag>]
  ./scripts/release.sh release [--dry-run] [--tag <tag>]

Notes:
  - bump updates package.json + package-lock.json without creating a git tag/commit.
  - bump auto uses the latest commit message (Conventional Commits style):
      * major: BREAKING CHANGE in body or "type(scope)!: ..."
      * minor: "feat: ..." or "feat(scope): ..."
      * patch: default fallback
  - publish enables provenance automatically in CI, and disables it for local runs.
  - release runs: determine bump -> bump version -> commit version files -> publish.
EOF
}

determine_bump_from_last_commit() {
  if ! command -v git >/dev/null 2>&1 || ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "patch"
    return 0
  fi

  commit_message="$(git log -1 --pretty=%B 2>/dev/null || true)"
  if [[ -z "$commit_message" ]]; then
    echo "patch"
    return 0
  fi

  if [[ "$commit_message" =~ BREAKING[[:space:]]CHANGE ]]; then
    echo "major"
    return 0
  fi

  first_line="$(printf '%s' "$commit_message" | awk 'NR==1{print; exit}')"
  if [[ "$first_line" =~ ^[a-zA-Z]+(\([a-zA-Z0-9._/-]+\))?!: ]]; then
    echo "major"
    return 0
  fi
  if [[ "$first_line" =~ ^feat(\([a-zA-Z0-9._/-]+\))?: ]]; then
    echo "minor"
    return 0
  fi

  echo "patch"
}

run_publish() {
  dry_run="$1"
  tag="$2"

  provenance_flag="--provenance=false"
  if [[ "${CI:-}" == "true" ]]; then
    provenance_flag="--provenance"
  fi

  publish_args=(publish --access public "$provenance_flag" --tag "$tag")
  if [[ "$dry_run" == "true" ]]; then
    publish_args+=(--dry-run)
  fi

  npm "${publish_args[@]}"
}

commit_version_files() {
  new_version="$1"

  if ! command -v git >/dev/null 2>&1 || ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "Skipping release commit (not a git repository)."
    return 0
  fi

  git add package.json package-lock.json
  if git diff --cached --quiet; then
    echo "No version file changes to commit."
    return 0
  fi

  git commit -m "chore(release): v${new_version}"
}

if [[ "${1:-}" == "" ]]; then
  usage
  exit 1
fi

command="$1"
shift

case "$command" in
  bump)
    level="${1:-}"
    if [[ "$level" == "auto" ]]; then
      level="$(determine_bump_from_last_commit)"
      echo "Auto-detected bump level from last commit: $level"
    fi
    if [[ "$level" != "patch" && "$level" != "minor" && "$level" != "major" ]]; then
      echo "Invalid bump level: '$level'. Expected patch|minor|major|auto."
      usage
      exit 1
    fi

    npm version "$level" --no-git-tag-version
    echo "Version bumped ($level). Commit package files and tag as needed."
    ;;

  determine-bump)
    determine_bump_from_last_commit
    ;;

  publish)
    dry_run="false"
    tag="latest"

    while [[ $# -gt 0 ]]; do
      case "$1" in
        --dry-run)
          dry_run="true"
          shift
          ;;
        --tag)
          tag="${2:-}"
          if [[ -z "$tag" ]]; then
            echo "Missing value for --tag"
            exit 1
          fi
          shift 2
          ;;
        *)
          echo "Unknown option: $1"
          usage
          exit 1
          ;;
      esac
    done

    run_publish "$dry_run" "$tag"
    ;;

  release)
    dry_run="false"
    tag="latest"

    while [[ $# -gt 0 ]]; do
      case "$1" in
        --dry-run)
          dry_run="true"
          shift
          ;;
        --tag)
          tag="${2:-}"
          if [[ -z "$tag" ]]; then
            echo "Missing value for --tag"
            exit 1
          fi
          shift 2
          ;;
        *)
          echo "Unknown option: $1"
          usage
          exit 1
          ;;
      esac
    done

    level="$(determine_bump_from_last_commit)"
    echo "Auto-detected bump level from last commit: $level"
    npm version "$level" --no-git-tag-version
    new_version="$(npm pkg get version | tr -d '"')"
    commit_version_files "$new_version"
    echo "Version bumped ($level) to v${new_version}. Publishing package..."
    run_publish "$dry_run" "$tag"
    ;;

  *)
    echo "Unknown command: $command"
    usage
    exit 1
    ;;
esac
