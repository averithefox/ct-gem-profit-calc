#!/bin/bash

MAJOR=0
MINOR=0
PATCH=1

COMMITS=$(git log --pretty=format:"%s" 2>/dev/null || echo "")

if [ -z "$COMMITS" ]; then
  echo "0.0.1"
  exit 0
fi

while IFS= read -r commit; do
  if [[ "$commit" =~ ^.*!: ]]; then
    MAJOR=$((MAJOR + 1))
    MINOR=0
    PATCH=0
  elif [[ "$commit" =~ ^feat ]]; then
    MINOR=$((MINOR + 1))
    PATCH=0
  elif [[ "$commit" =~ ^fix ]]; then
    PATCH=$((PATCH + 1))
  fi
done < <(echo "$COMMITS" | tac)

echo "$MAJOR.$MINOR.$PATCH"
