#!/usr/bin/env sh
# Builds the site and force-pushes dist/ to the gh-pages branch (GitHub Pages source).
set -e
npm run check
npm run build
cd dist
touch .nojekyll
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C .. config user.name)" -c user.email="$(git -C .. config user.email)" commit -q -m "Deploy $(git -C .. rev-parse --short HEAD)"
git push -q -f "$(git -C .. remote get-url origin)" gh-pages
rm -rf .git
