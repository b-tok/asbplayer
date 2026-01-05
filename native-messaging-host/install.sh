#!/bin/bash
# asbplayer Native Messaging Host Installer for Firefox

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
HOST_NAME="dev.asbplayer.audio"
MANIFEST_FILE="$HOST_NAME.json"

echo "=== asbplayer Native Messaging Host Installer ==="
echo ""

# Check if Firefox native messaging directory exists
NATIVE_MESSAGING_DIR="$HOME/.mozilla/native-messaging-hosts"

if [ ! -d "$NATIVE_MESSAGING_DIR" ]; then
    echo "Creating native messaging directory: $NATIVE_MESSAGING_DIR"
    mkdir -p "$NATIVE_MESSAGING_DIR"
fi

# Update the path in the manifest to use absolute path
MANIFEST_SOURCE="$SCRIPT_DIR/$MANIFEST_FILE"
MANIFEST_DEST="$NATIVE_MESSAGING_DIR/$MANIFEST_FILE"

if [ ! -f "$MANIFEST_SOURCE" ]; then
    echo "Error: Manifest file not found: $MANIFEST_SOURCE"
    exit 1
fi

# Create a copy of the manifest with the correct absolute path
PYTHON_SCRIPT="$SCRIPT_DIR/asbplayer_audio_host.py"

if [ ! -f "$PYTHON_SCRIPT" ]; then
    echo "Error: Python script not found: $PYTHON_SCRIPT"
    exit 1
fi

# Make sure the Python script is executable
chmod +x "$PYTHON_SCRIPT"

# Update the manifest with the absolute path
cat "$MANIFEST_SOURCE" | sed "s|\"path\": \".*\"|\"path\": \"$PYTHON_SCRIPT\"|" > "$MANIFEST_DEST"

echo "✓ Installed native messaging host manifest to: $MANIFEST_DEST"
echo "✓ Python script location: $PYTHON_SCRIPT"
echo ""

# Check which audio system is running
echo "Checking audio system..."

if systemctl --user is-active pipewire >/dev/null 2>&1; then
    echo "✓ PipeWire detected"

    # Check if pw-record is available
    if ! command -v pw-record >/dev/null 2>&1; then
        echo "⚠ Warning: pw-record command not found"
        echo "  Install it with: sudo apt install pipewire-audio-client-libraries"
        echo "  Or: sudo dnf install pipewire-utils"
    else
        echo "✓ pw-record is available"
    fi

    # Check if pw-dump is available
    if ! command -v pw-dump >/dev/null 2>&1; then
        echo "⚠ Warning: pw-dump command not found"
        echo "  Install it with: sudo apt install pipewire-audio-client-libraries"
        echo "  Or: sudo dnf install pipewire-utils"
    else
        echo "✓ pw-dump is available"
    fi
elif pulseaudio --check 2>/dev/null; then
    echo "✓ PulseAudio detected"

    # Check if parecord is available
    if ! command -v parecord >/dev/null 2>&1; then
        echo "⚠ Warning: parecord command not found"
        echo "  Install it with: sudo apt install pulseaudio-utils"
        echo "  Or: sudo dnf install pulseaudio-utils"
    else
        echo "✓ parecord is available"
    fi

    # Check if pactl is available
    if ! command -v pactl >/dev/null 2>&1; then
        echo "⚠ Warning: pactl command not found"
        echo "  Install it with: sudo apt install pulseaudio-utils"
        echo "  Or: sudo dnf install pulseaudio-utils"
    else
        echo "✓ pactl is available"
    fi
else
    echo "⚠ Warning: Could not detect PipeWire or PulseAudio"
    echo "  The audio recording may not work without one of these audio systems"
fi

echo ""
echo "=== Installation Complete ==="
echo ""
echo "The native messaging host has been installed successfully."
echo ""
echo "Next steps:"
echo "1. Restart Firefox"
echo "2. Reload the asbplayer extension (about:debugging > Reload)"
echo "3. The extension should now be able to record audio from DRM-protected content"
echo ""
echo "To uninstall, run: rm $MANIFEST_DEST"
