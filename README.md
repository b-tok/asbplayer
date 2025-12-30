# asbplayer-linux

**asbplayer-linux** is a fork of [asbplayer](https://github.com/killergerbah/asbplayer) - a browser-based media player and Chrome extension developed for language learners who learn their target language through subtitled media. This version includes native messaging host support for Firefox on Linux to enable DRM audio recording. With asbplayer-linux, you can:

- **Easily create high-quality, multimedia flashcards** out of subtitled videos.
- **Load text-selectable subtitles onto most video sources**, including streaming sources.
- **Extract subtitles from popular streaming services** like Netflix and YouTube.
- **Seek through subtitles** using a **navigable subtitle list**.
- **Optimize language-learning efficiency** using subtitled videos with **playback modes** like:
    - **Condensed playback**: Only play subtitled sections of a video.
    - **Fast-forward playback**: Fast-forward through unsubtitled sections of video.
    - **Auto-pause**: Automatically pause at the beginning or end of every subtitle.
- **Use customizable keyboard shortcuts** to access most of asbplayer's features.

## User guide

asbplayer's complete user guide is [here](https://docs.asbplayer.dev/docs/intro).

## Getting Started

> [!NOTE]
> asbplayer is both a subtitle control and flashcard creation tool. If you are not interested in flashcards, and only want to use asbplayer's subtitle features, just follow step 5.

1. Install and set up a dictionary tool for your target language that allows you to do instant lookups. Popular ones are [Yomitan](https://chromewebstore.google.com/detail/yomitan/likgccmbimhjbgkjambclfkhldnlhbnn) (see [supported languages](https://yomitan.wiki/other/supported-languages/)) and [VocabSieve](https://github.com/FreeLanguageTools/vocabsieve) (tuned for European languages. Works with Asian languages too but doesn't automatically detect word boundaries).
2. Install [Anki](https://apps.ankiweb.net/), and create a deck and note type. More details on [Refold's guide](https://refold.la/roadmap/stage-1/a/anki-setup).
3. Install the [AnkiConnect](https://ankiweb.net/shared/info/2055492159) plugin for Anki.
4. [Configure](https://docs.asbplayer.dev/docs/intro) asbplayer-linux to create cards via AnkiConnect using your deck and note type.
5. Enhance a video using asbplayer and subtitle files.
    - **For streaming video:** After installing the [browser extension](https://github.com/b-tok/asbplayer/releases/latest), drag-and-drop a subtitle file into the streaming video you want to mine.
    - **For local files:** Drag-and-drop media/subtitle files into the [asbplayer website](https://docs.asbplayer.dev/docs/intro).

    You may have to [adjust the subtitle offset](https://docs.asbplayer.dev/docs/guides/subtitle-timing) to get the subtitles in sync.

6. When a subtitle appears that you want to mine, use <kbd>Ctrl + Shift + X</kbd> to open the flashcard creator.
7. Fill in the definition and word fields and then export the card. To fill in the definition field you may use the dictionary you installed in step 1.

## Native Messaging Host (Firefox on Linux)

This version of asbplayer includes native messaging host support for recording audio from DRM-protected content (Netflix, Crunchyroll, etc.) in Firefox on Linux.

### Installation

```bash
cd /home/boris/apps/asbplayer/native-messaging-host
./install.sh
```

For detailed instructions, including troubleshooting and manual installation, see [native-messaging-host/README.md](./native-messaging-host/README.md).

### Requirements

- Python 3
- PipeWire (recommended) or PulseAudio
- Firefox browser

The native messaging host enables DRM audio recording by using system-level audio capture via PipeWire/PulseAudio when Firefox's built-in `captureStream()` API is blocked.

## Notes for AMO source code reviewers

### Environment

```
node 22.17.1
yarn 3.2.0
```

### About This Build Process

This extension uses the WXT framework for building. Source files are written in TypeScript and are compiled/transpiled during the build process. The source code is completely separate from the built extension files. When submitting to AMO, a sources zip file is automatically created by WXT that includes all original TypeScript source files, allowing reviewers to verify the code.

### Build System Overview

- **WXT Framework**: A modern web extension framework that handles the build process
- **TypeScript**: Source files are written in TypeScript and compiled to JavaScript
- **Vite**: Build tool used by WXT for bundling and optimization
- **Build Output**: The extension is built to `extension/.output/` directory with separate folders for each browser target

### Source Code Verification

The build process automatically creates a `*-sources.zip` file alongside the extension zip, which contains:

- All TypeScript source files (`extension/src/`, `common/`, `client/`)
- Configuration files (package.json, tsconfig.json, wxt.config.ts, etc.)
- Build scripts and dependencies

Reviewers can verify that:

1. Source files are not minified (they remain in original TypeScript form)
2. All source code is included in the sources zip
3. The build process only compiles/transforms code but does not obfuscate or encrypt it

### Building

```bash
# Install dependencies
yarn

# Verify the code (runs tests, linting, and type checking)
yarn verify

# Build Firefox extension to extension/.output/projectextension-<version>-firefox.zip
yarn workspace @project/extension run wxt zip -b firefox

# Build Firefox for Android extension to extension/.output/projectextension-<version>-firefox-android.zip
yarn workspace @project/extension run wxt zip -b firefox-android --mv2
```

The build commands above will create two zip files in `extension/.output/`:

1. The extension XPI file (for submission to AMO)
2. A sources zip file containing all source code (for review)
