#!/bin/bash

MAJOR=0
MINOR=0
PATCH=1

COMMITS=$(git log --pretty=format:"%s" 2>/dev/null || echo "")

if [ -z "$COMMITS" ]; then
  echo "0.0.1"
  exit 0
fi

BREAKING_CHANGES=$(echo "$COMMITS" | grep -c "^.*!:" || true)
FEATURES=$(echo "$COMMITS" | grep -c "^feat" || true)
FIXES=$(echo "$COMMITS" | grep -c "^fix" || true)

if [ "$BREAKING_CHANGES" -gt 0 ]; then
  MAJOR=$((MAJOR + 1))
  MINOR=0
  PATCH=0
elif [ "$FEATURES" -gt 0 ]; then
  MINOR=$((MINOR + 1))
  PATCH=0
elif [ "$FIXES" -gt 0 ]; then
  PATCH=$((PATCH + 1))
fi

echo "$MAJOR.$MINOR.$PATCH"
