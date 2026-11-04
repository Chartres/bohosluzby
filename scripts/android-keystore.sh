#!/usr/bin/env bash
# One-time, at the Mac mini: create the Android UPLOAD keystore for Kam na mši and
# store it as GitHub Actions secrets for .github/workflows/release-android.yml.
# No secret value is ever printed: the values go straight into `gh secret set`, and
# the password is kept for you in the macOS Keychain (else a chmod-600 file).
#
#   scripts/android-keystore.sh                       # new upload key → 4 secrets
#   scripts/android-keystore.sh --play-json key.json  # Play service-account key → PLAY_SERVICE_ACCOUNT_JSON
#
# Google Play App Signing keeps the real signing key on Google's side; this is only
# the upload key, and you can reset it in Play Console if it is ever lost.
# Needs: a JDK (keytool), openssl, and gh logged in to GitHub (gh auth login).
set -euo pipefail

REPO="${REPO:-Chartres/bohosluzby}"
ALIAS="${ALIAS:-upload}"
OUT_DIR="${OUT_DIR:-$HOME/.config/kam-na-msi}"
KS="$OUT_DIR/android-upload.jks"
SERVICE="kam-na-msi android upload key"

need() { command -v "$1" >/dev/null || { echo "✗ $1 not found — $2"; exit 1; }; }
need gh "install the GitHub CLI (brew install gh) and run: gh auth login"
gh auth status >/dev/null 2>&1 || { echo "✗ gh is not logged in — run: gh auth login"; exit 1; }

if [ "${1:-}" = "--play-json" ]; then
  f="${2:-}"
  [ -f "$f" ] || { echo "✗ usage: $0 --play-json path/to/service-account-key.json"; exit 1; }
  gh secret set PLAY_SERVICE_ACCOUNT_JSON --repo "$REPO" < "$f"
  echo "✓ PLAY_SERVICE_ACCOUNT_JSON set on $REPO."
  echo "  Delete the downloaded key file now: rm \"$f\""
  exit 0
fi

need keytool "install a JDK (brew install --cask temurin)"
need openssl "install openssl"
mkdir -p "$OUT_DIR"; chmod 700 "$OUT_DIR"
if [ -f "$KS" ]; then
  echo "✗ keystore already exists: $KS (it is already in use; delete it only if you really want a new upload key)"; exit 1
fi

KS_PASS="$(openssl rand -base64 30 | tr -d '/+=\n' | cut -c1-32)"
export KS_PASS # read by keytool through :env, never on its command line

# keep the password first: if a later step fails, the keystore is never stranded
if command -v security >/dev/null; then
  security add-generic-password -U -a "$ALIAS" -s "$SERVICE" -w "$KS_PASS" </dev/null
  where="macOS Keychain, item \"$SERVICE\""
else
  ( umask 077; printf '%s\n' "$KS_PASS" > "$OUT_DIR/android-upload.pass" )
  where="$OUT_DIR/android-upload.pass (only you can read it)"
fi

if ! err=$(keytool -genkeypair -v \
  -keystore "$KS" -storepass:env KS_PASS -keypass:env KS_PASS \
  -alias "$ALIAS" -keyalg RSA -keysize 4096 -validity 10000 \
  -dname "CN=Kam na mši, O=Pavol Dravecký, L=Praha, C=CZ" 2>&1 >/dev/null); then
  echo "✗ keytool failed: $err"; exit 1
fi
chmod 600 "$KS"

base64 < "$KS" | tr -d '\n' | gh secret set ANDROID_KEYSTORE_BASE64   --repo "$REPO"
printf '%s' "$KS_PASS" | gh secret set ANDROID_KEYSTORE_PASSWORD --repo "$REPO"
printf '%s' "$ALIAS"   | gh secret set ANDROID_KEY_ALIAS         --repo "$REPO"
printf '%s' "$KS_PASS" | gh secret set ANDROID_KEY_PASSWORD      --repo "$REPO"

echo "✓ upload keystore: $KS"
echo "✓ 4 secrets set on $REPO (ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD)"
echo "✓ password kept in: $where"
echo "  Upload certificate fingerprint (public, for Play Console if it asks):"
keytool -list -v -keystore "$KS" -storepass:env KS_PASS -alias "$ALIAS" 2>/dev/null | grep -E "SHA256:" | head -1
unset KS_PASS
