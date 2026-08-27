# Brainmax

**A focused cognitive-training app for practising the reasoning patterns behind technical and aptitude assessments.**

[![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Tests](https://img.shields.io/badge/tests-138%20passing-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)

Brainmax turns short practice sessions into structured, measurable training. It combines mental maths, logic puzzles, memory challenges, spatial reasoning and reaction exercises in a responsive interface that runs in the browser or as a self-contained native app on macOS and iOS.

The project is deliberately local-first: exercises are generated on-device, progress stays on-device, and the native apps continue to work without a network connection.

## Highlights

- **20 exercise families** across numerical, logical and cognitive training tracks
- **Adaptive difficulty** that adjusts each skill independently across ten levels
- **Seeded exercise generation** for varied but deterministic, testable questions
- **Flexible sessions** from 30-second sprints to untimed practice and five-minute warm-ups
- **Mock assessment mode** with timed sections, question navigation and deferred feedback
- **Meaningful progress tracking** including accuracy, streaks, response times, scores and per-skill breakdowns
- **Purpose-built interactions** for matrices, cube nets, route planning, pattern recall, spatial rotation and reaction timing
- **Local persistence** with migration support for older session data
- **Cross-platform delivery** through a responsive React app and lightweight Swift/WebKit shells for macOS and iOS

## Training tracks

| Track | What it covers |
| --- | --- |
| **Fast Numbers+** | Arithmetic, percentages, fractions, ratios, averages, rates and units, powers and roots, and estimation |
| **Logic Lab** | Number sequences, visual matrices, rule-breaking puzzles and constraint logic |
| **Cognitive Games** | Data interpretation, precision recall, pattern memory, sequence tracking, reaction speed, spatial reasoning and route planning |

Every generated exercise includes a concise explanation. Adaptive sessions raise or lower the level of each exercise family independently, so improvement in one skill does not make unrelated drills unnecessarily difficult.

## How it works

The React application owns the training experience, exercise engine and local session history. Exercise generators use seeded pseudo-randomness, which keeps the question library varied while making its output reproducible in automated tests.

For native distribution, the production web build is compiled into a single local HTML asset. Small Swift hosts load that asset in `WKWebView`, providing installable macOS and iOS apps without requiring a server at runtime.

```text
src/                         React interface, exercise engine and tests
scripts/                     Web-to-native packaging and macOS build scripts
macos/                       Native macOS host and app metadata
ios/Brainmax/                Native iOS host, bundled web app and icons
ios/Brainmax.xcodeproj/      Xcode project
```

## Built with

- React and TypeScript
- Vite
- Vitest
- Lucide icons
- Swift, SwiftUI and WebKit for the native shells

## Getting started

### Prerequisites

- A current Node.js release and npm
- macOS with Xcode command-line tools for the native macOS build
- Xcode for building the iOS app

### Run the web app

```bash
git clone https://github.com/MYLO175/Brainmaxing.git
cd Brainmaxing
npm install
npm run dev
```

Vite will print the local development URL in the terminal.

### Test and build

```bash
npm test
npm run build
```

The test suite checks session scoring and migration behaviour, validates every exercise family across all ten difficulty levels, and verifies that generated questions remain deterministic and answerable.

## macOS app

To build, install and open the self-contained app:

```bash
npm run mac
```

This safely replaces `/Applications/Brainmax.app`. Its rollback copy exists only in `/private/tmp` while installation is in progress, so updates do not leave dated app bundles in Applications.

To build without installing or opening the app:

```bash
npm run mac:build
```

The build-only app is written to `/private/tmp/brainmax-native-build/Brainmax.app`.

Once installed, Brainmax opens from the Applications folder like any other Mac app. It is fully self-contained and does not require a Terminal window or local server.

## iOS app

The iOS app is in `ios/Brainmax.xcodeproj`. It bundles the full Brainmax interface, works offline and stores progress in WebKit's persistent local data store.

1. Open `ios/Brainmax.xcodeproj` in Xcode.
2. Select the **Brainmax** project, then the **Brainmax** target.
3. Under **Signing & Capabilities**, select your Apple ID's personal team.
4. Connect and unlock your iPhone, select it in Xcode's device menu and press **Run**.
5. If prompted by iOS, enable **Developer Mode** and trust your developer certificate.

With a free Apple ID, development signing normally lasts seven days. Reconnect the phone and press **Run** again before it expires. A paid Apple Developer account provides longer-lived signing options.

After changing the React app, refresh the copy bundled by Xcode with:

```bash
npm run ios:sync
```

To verify the iOS project against the local device SDK without code signing:

```bash
npm run ios:build
```

## Data and privacy

Brainmax does not require an account or a backend. Session history and preferences are stored locally in the browser or native app's WebKit data store. Clearing that storage removes the saved progress.

## Project status

Brainmax is a personal project under active development. Its assessment mode is intended for practice and reports a personal training score, not a commercial assessment percentile.

## License

Copyright © 2026 Mylo. All rights reserved.

The source code is publicly viewable for demonstration purposes only.
No permission is granted to copy, modify, distribute, or use it without
explicit written permission.
