# Pickleball Desk

An offline Android tablet app for running open play: a saved roster, matchmaking onto courts, results, Excel export and backups. It never talks to the online system. Everything is stored on the tablet.

It's a Vite + React app wrapped with Capacitor. It shares its rules (matchmaking, scoring, re-queue, leaderboard) with the web app through `../src/features/**/utils`.

## Develop

```bash
npm install
npm run dev
```

This opens the app at http://localhost:5180. Data lives in the browser's IndexedDB.

Tests run from the repo root with the rest of the suite:

```bash
npx vitest run tablet
```

## Build the APK

You need Android Studio (or the Android SDK) and JDK 21. If `JAVA_HOME` points at an older JDK, `scripts/gradle.mjs` uses `C:/Program Files/Java/jdk-21` when it exists, or whatever you set in `DESK_JAVA_HOME`.

```bash
npm run apk:release
```

The signed APK is written to `android/app/build/outputs/apk/release/app-release.apk`.

For a quick unsigned test build, run `npm run apk:debug`.

## The signing key: back it up

Release builds are signed with a key that lives **outside this repo**:

- **The key:** `%USERPROFILE%\.pickleball-desk\pickleball-desk.jks`
- **Its passwords:** `tablet/android/keystore.properties`. This file is git-ignored.

Keep a copy of both somewhere safe, such as a password manager or a private drive.

Android only installs an update over the old app if it's signed with the **same key**. If the key is lost, the next version can only be installed after uninstalling the app, and uninstalling wipes the tablet's data unless you restore a backup.

To build on another computer, copy both files there and fix `storeFile` in `keystore.properties` to point at the `.jks`.

## Install on the tablet

1. Copy `app-release.apk` to the tablet: USB cable, Google Drive, or send it to yourself in a chat app.
2. Open it on the tablet. Android asks you to allow installs from that app (Files, Drive or Chrome). Allow it once.
3. Tap **Install**. **Pickleball Desk** appears on the home screen.

### Updating

Build a new APK the same way, copy it over, and install it on top of the old one. Players and sessions stay.

## First-time checklist on a real tablet

- [ ] The APK installs, and the app opens in landscape.
- [ ] Turn Wi-Fi off. Everything below still works.
- [ ] Add a few players on the Roster, start a session, and check players in.
- [ ] Start and finish a few games. Try Undo, Fix result, a break and gone home.
- [ ] Close the app completely and reopen it. It returns to the live board unchanged.
- [ ] The screen stays on during a live session.
- [ ] End the session. Export to Excel opens the share sheet, and the file opens in Sheets or Excel.
- [ ] Backup → Save backup opens the share sheet. Save the file to Drive.
- [ ] Install the same APK again on top. The data is still there.
