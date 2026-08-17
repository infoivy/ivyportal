#!/bin/bash
# Ivy Portal iOS → TestFlight in one command.
#
# Prerequisites (one-time):
#   1. Apple Developer Program membership (developer.apple.com, $99/yr).
#   2. App Store Connect → Users and Access → Integrations → App Store
#      Connect API → generate a TEAM key with "App Manager" access.
#      Download the .p8 file once; note the Key ID and Issuer ID.
#   3. An app record is created automatically on first upload when the
#      bundle id (com.ivysalesacademy.ivyportal) is registered — register it
#      at developer.apple.com → Identifiers, or let Xcode's automatic
#      signing create it on first archive.
#
# Usage:
#   TEAM_ID=XXXXXXXXXX \
#   ASC_KEY_ID=ABC123DEFG \
#   ASC_ISSUER_ID=12345678-aaaa-bbbb-cccc-1234567890ab \
#   ASC_KEY_PATH=$HOME/keys/AuthKey_ABC123DEFG.p8 \
#   ./scripts/testflight.sh
#
# Each run auto-increments the build number via the current UTC timestamp,
# so repeated uploads never collide.

set -euo pipefail
cd "$(dirname "$0")/.."

: "${TEAM_ID:?Set TEAM_ID to your Apple Developer Team ID}"
: "${ASC_KEY_ID:?Set ASC_KEY_ID to your App Store Connect API Key ID}"
: "${ASC_ISSUER_ID:?Set ASC_ISSUER_ID to your App Store Connect Issuer ID}"
: "${ASC_KEY_PATH:?Set ASC_KEY_PATH to the AuthKey_<ID>.p8 file path}"

export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
BUILD_NUMBER=$(date -u +%Y%m%d%H%M)
ARCHIVE_PATH=".build/IvyPortal-${BUILD_NUMBER}.xcarchive"

echo "==> Regenerating Xcode project"
xcodegen generate --spec project.yml

echo "==> Archiving (build ${BUILD_NUMBER})"
xcodebuild -project IvyPortal.xcodeproj \
  -scheme IvyPortal \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE_PATH" \
  CODE_SIGNING_ALLOWED=YES \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  CURRENT_PROJECT_VERSION="$BUILD_NUMBER" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$ASC_KEY_PATH" \
  -authenticationKeyID "$ASC_KEY_ID" \
  -authenticationKeyIssuerID "$ASC_ISSUER_ID" \
  archive

echo "==> Uploading to App Store Connect (TestFlight)"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportOptionsPlist ExportOptions.plist \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$ASC_KEY_PATH" \
  -authenticationKeyID "$ASC_KEY_ID" \
  -authenticationKeyIssuerID "$ASC_ISSUER_ID"

echo "==> Done. The build appears in App Store Connect → TestFlight in a few
minutes (first build needs the export-compliance question answered once —
already declared in Info.plist — and internal testers added once)."
