# Brainmax

## Install on an iPhone with Xcode

The iOS app is in `ios/Brainmax.xcodeproj`. It bundles the full Brainmax interface,
works offline, and stores progress in the app's persistent WebKit data store.

1. Open `ios/Brainmax.xcodeproj` in Xcode.
2. Select the **Brainmax** project, then the **Brainmax** target.
3. Under **Signing & Capabilities**, select your Apple ID's personal team.
4. Connect and unlock your iPhone, select it in Xcode's device menu, and press **Run**.
5. If iOS asks, enable **Developer Mode** and trust your developer certificate.

With a free Apple ID, the development signing normally lasts seven days. Reconnect
the phone and press **Run** again before it expires. A paid Apple Developer account
has longer-lived signing options.

After changing the React app, refresh the copy bundled by Xcode with:

```bash
npm run ios:sync
```

To verify the iOS project against the local device SDK without code signing:

```bash
npm run ios:build
```

## Open the app

Open **Brainmax** from the Applications folder like any other Mac app. It is self-contained: no Terminal window or local server is required.

To keep it in the Dock, open Brainmax, right-click its Dock icon, then choose **Options → Keep in Dock**.

## Production build

```bash
npm run build
```

To build, replace the single installed macOS app, and reopen it:

```bash
npm run mac
```

This safely updates `/Applications/Brainmax.app`. Its rollback copy exists only
in `/private/tmp` while installation is in progress, so updates do not leave
dated app bundles in Applications.

To build the app without installing or opening it:

```bash
npm run mac:build
```

The build-only app is written to
`/private/tmp/brainmax-native-build/Brainmax.app`.
