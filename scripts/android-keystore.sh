#!/usr/bin/env bash
# One-time: create the Android UPLOAD keystore for Kam na mši and store it as
# GitHub Actions secrets for .github/workflows/release-android.yml.
#
#   scripts/android-keystore.sh            # generates + sets secrets via `gh`
#   scripts/android-keystore.sh --print    # generates + prints the values instead
#
# Google Play App Signing keeps the real signing key on Google's side; this is
# only the upload key, and Google can reset it if it is ever lost. Still: keep
# the .jks + password in your password manager (1Password: "kam-na-msi android
# upload key"). The file is written OUTSIDE the repo and never committed.
set -euo pipefail

REPO="${REPO:-Chartres/bohosluzby}"
ALIAS="${ALIAS:-upload}"
OUT_DIR="${OUT_DIR:-$HOME/.config/kam-na-msi}"
KS="$OUT_DIR/android-upload.jks"
mkdir -p "$OUT_DIR"; chmod 700 "$OUT_DIR"

if [ -f "$KS" ]; then
  echo "keystore already exists: $KS (delete it first if you really want a new one)"; exit 1
fi

command -v keytool >/dev/null || { echo "keytool not found — install a JDK (brew install --cask temurin)"; exit 1; }

PASS="$(openssl rand -base64 30 | tr -d '/+=' | cut -c1-32)"
keytool -genkeypair -v \
  -keystore "$KS" -storepass "$PASS" -keypass "$PASS" \
  -alias "$ALIAS" -keyalg RSA -keysize 4096 -validity 10000 \
  -dname "CN=Kam na mši, O=Pavol Dravecký, L=Praha, C=CZ" >/dev/null
chmod 600 "$KS"
B64="$(base64 < "$KS" | tr -d '\n')"

echo "keystore: $KS"
echo "alias:    $ALIAS"
echo "SHA-256 (paste into Play Console if it asks for the upload certificate):"
keytool -list -v -keystore "$KS" -storepass "$PASS" -alias "$ALIAS" | grep -E "SHA256:" | head -1

if [ "${1:-}" = "--print" ] || ! command -v gh >/dev/null; then
  echo
  echo "Set these four secrets on $REPO (Settings → Secrets and variables → Actions):"
  echo "  ANDROID_KEYSTORE_BASE64  = (base64 of $KS — see $OUT_DIR/android-upload.b64)"
  echo "  ANDROID_KEYSTORE_PASSWORD = $PASS"
  echo "  ANDROID_KEY_ALIAS         = $ALIAS"
  echo "  ANDROID_KEY_PASSWORD      = $PASS"
  printf '%s' "$B64" > "$OUT_DIR/android-upload.b64"; chmod 600 "$OUT_DIR/android-upload.b64"
  exit 0
fi

printf '%s' "$B64"  | gh secret set ANDROID_KEYSTORE_BASE64   --repo "$REPO"
printf '%s' "$PASS" | gh secret set ANDROID_KEYSTORE_PASSWORD --repo "$REPO"
printf '%s' "$ALIAS"| gh secret set ANDROID_KEY_ALIAS         --repo "$REPO"
printf '%s' "$PASS" | gh secret set ANDROID_KEY_PASSWORD      --repo "$REPO"
echo "secrets set on $REPO. Password (store it in 1Password now): $PASS"
echo "Next: git tag android-v1.2.0 && git push origin android-v1.2.0  → signed .aab on the GitHub Release."
