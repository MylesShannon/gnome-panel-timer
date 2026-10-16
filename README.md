# GNOME Panel Timer

A countdown timer for GNOME Shell 46, with a custom label, flashing alert, and optional audio alarm in the top bar.

## Compatibility

Requires **GNOME Shell 46**. This is a GNOME Shell extension; it does not run in KDE Plasma or other desktop environments. Other GNOME Shell versions are not currently supported.

In GNOME's Extensions app, it appears as **Labelled Countdown**. Its extension ID is `labelled-countdown@myles.local`, which is used in the installation and removal commands below.

## Use

1. Click **Timer** in the top bar.
2. Enter a **Label**, such as `Tea break`.
3. Enter a **Duration**: `25` for 25 minutes, `0:30` for 30 seconds, or `1:15:00` for 1 hour 15 minutes.
4. Click **Start timer**, or press Enter in the duration field.

The menu offers **Pause**, **Resume**, and **Reset**. **Restart timer** starts a fresh countdown using the duration field. Labels can be changed while a timer runs.

At zero, the panel indicator flashes red. With **Audio alarm** enabled, a short chime repeats about every five seconds. Switch audio off to silence it immediately; the visual alert continues. **Dismiss alarm** clears both alerts. Sound uses your system audio output and volume.

The last started duration, label, sound preference, and countdown state are saved locally with GSettings. Timers use a wall-clock deadline, so sleep and GNOME reloads do not extend them; manually changing the system clock can change the remaining time. If a timer expires while the extension is disabled, it alerts when enabled again. Alerts cannot run while the computer is asleep or the extension is disabled, including the lock screen.

One timer is supported. Duration limits are one second to 24 hours. Labels accept up to 80 characters and are visually shortened in the panel when needed. Sound is enabled by default.

## Install or reinstall

Clone the private repository using a GitHub account with access:

```sh
git clone https://github.com/MylesShannon/gnome-panel-timer.git
cd gnome-panel-timer
```

From the repository directory, build and install the extension:

```sh
mkdir -p dist
gnome-extensions pack --force --extra-source=timer.js --extra-source=alarm.wav --out-dir=dist .
gnome-extensions install --force dist/labelled-countdown@myles.local.shell-extension.zip
gnome-extensions enable labelled-countdown@myles.local
```

GNOME may require a logout/login to discover a new installation or load updated JavaScript. On X11, Alt+F2, `r`, Enter can reload Shell.

Installed files live in `~/.local/share/gnome-shell/extensions/labelled-countdown@myles.local/`.

## Disable or remove

```sh
gnome-extensions disable labelled-countdown@myles.local
gnome-extensions uninstall labelled-countdown@myles.local
```

Uninstalling leaves preferences in GSettings. To discard them too:

```sh
dconf reset -f /org/gnome/shell/extensions/labelled-countdown/
```

## Development

No downloaded dependencies are needed. GNOME supplies GJS and the UI APIs. Node.js is only used for tests.

```sh
node tests/timer.test.js
glib-compile-schemas --strict schemas
node --check extension.js
mkdir -p dist
gnome-extensions pack --force --extra-source=timer.js --extra-source=alarm.wav --out-dir=dist .
```

`timer.js` implements parsing, formatting, and the countdown state machine. `extension.js` owns the GNOME menu, settings, flashing, and cancellable sound playback. The bundled WAV is an original synthesized chime.

Validated on GNOME 46 with ten timer tests plus an isolated GNOME session covering menu actions, validation, expiry, flashing, audio toggle/cancellation, dismissal, and disable/re-enable restoration.
