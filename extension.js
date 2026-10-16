import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as ShellEntry from 'resource:///org/gnome/shell/ui/shellEntry.js';

import {Countdown, formatTime, parseDuration} from './timer.js';

export default class LabelledCountdown extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._timer = new Countdown(this._settings.get_string('timer-state'));
        this._tickId = 0;
        this._alarmId = 0;
        this._flashId = 0;
        this._sound = null;
        this._button = new PanelMenu.Button(0.5, 'Labelled Countdown');
        const box = new St.BoxLayout({style_class: 'countdown-panel-box'});
        this._icon = new St.Icon({icon_name: 'alarm-symbolic', style_class: 'system-status-icon'});
        this._label = new St.Label({y_align: Clutter.ActorAlign.CENTER,
            style_class: 'countdown-panel-label'});
        this._time = new St.Label({y_align: Clutter.ActorAlign.CENTER,
            style_class: 'countdown-time'});
        box.add_child(this._icon);
        box.add_child(this._label);
        box.add_child(this._time);
        this._button.add_child(box);
        this._buildMenu();
        Main.panel.addToStatusArea(this.uuid, this._button);
        this._settingsSignal = this._settings.connect('changed', (_settings, key) => {
            if (key === 'sound-enabled') {
                this._soundSwitch.setToggleState(this._settings.get_boolean(key));
                this._syncSound();
            } else if (key === 'label') {
                const text = this._settings.get_string(key);
                if (this._labelEntry.get_text() !== text)
                    this._labelEntry.set_text(text);
            }
            this._render();
        });
        this._sync();
    }

    _buildMenu() {
        const menu = this._button.menu;
        const heading = new PopupMenu.PopupMenuItem('Countdown', {reactive: false});
        heading.add_style_class_name('countdown-heading');
        menu.addMenuItem(heading);
        this._labelEntry = this._addEntry('Label', this._settings.get_string('label'));
        this._labelEntry.clutter_text.set_max_length(80);
        this._labelEntry.clutter_text.connect('text-changed', () => {
            this._settings.set_string('label', this._labelEntry.get_text());
        });
        this._durationEntry = this._addEntry('Duration', formatTime(this._settings.get_int('duration')));
        this._durationEntry.clutter_text.set_max_length(12);
        this._durationEntry.clutter_text.connect('activate', () => this._start());
        this._help = new PopupMenu.PopupMenuItem('Minutes, MM:SS, or HH:MM:SS · up to 24h', {reactive: false});
        this._help.add_style_class_name('countdown-help');
        menu.addMenuItem(this._help);
        this._durationEntry.clutter_text.connect('text-changed', () => this._validate());
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._startItem = menu.addAction('Start timer', () => this._start());
        this._pauseItem = menu.addAction('Pause', () => {
            if (this._timer.status === 'running')
                this._timer.pause();
            else
                this._timer.resume();
            this._sync();
        });
        this._resetItem = menu.addAction('Reset', () => this._reset());
        this._dismissItem = menu.addAction('Dismiss alarm', () => this._reset());
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._soundSwitch = new PopupMenu.PopupSwitchMenuItem('Audio alarm',
            this._settings.get_boolean('sound-enabled'));
        this._soundSwitch.connect('toggled', (_item, state) => {
            this._settings.set_boolean('sound-enabled', state);
        });
        menu.addMenuItem(this._soundSwitch);
    }

    _addEntry(label, text) {
        const row = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        const caption = new St.Label({text: label, style_class: 'countdown-field-label',
            y_align: Clutter.ActorAlign.CENTER});
        const entry = new St.Entry({text, can_focus: true, x_expand: true,
            style_class: 'countdown-entry', accessible_name: label});
        row.add_child(caption);
        row.add_child(entry);
        ShellEntry.addContextMenu(entry);
        this._button.menu.addMenuItem(row);
        return entry;
    }

    _validate() {
        const seconds = parseDuration(this._durationEntry.get_text());
        this._startItem.setSensitive(seconds !== null);
        this._help.label.set_text(seconds === null
            ? 'Enter 0:01–24:00:00 (or whole minutes)'
            : 'Minutes, MM:SS, or HH:MM:SS · up to 24h');
        if (seconds === null)
            this._help.add_style_class_name('countdown-error');
        else
            this._help.remove_style_class_name('countdown-error');
        return seconds;
    }

    _start() {
        const seconds = this._validate();
        if (seconds === null)
            return;
        this._settings.set_int('duration', seconds);
        this._timer.start(seconds);
        this._sync();
        this._button.menu.close();
    }

    _reset() {
        this._timer.reset();
        this._sync();
    }

    _sync() {
        this._timer.tick();
        this._settings.set_string('timer-state', this._timer.serialize());
        this._removeSource('_tickId');
        if (this._timer.status === 'running') {
            this._tickId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
                if (this._timer.tick()) {
                    this._tickId = 0;
                    this._sync();
                    return GLib.SOURCE_REMOVE;
                }
                this._render();
                return GLib.SOURCE_CONTINUE;
            });
        }
        if (this._timer.status === 'expired') {
            if (!this._flashId) {
                this._button.add_style_class_name('countdown-flash');
                this._flashId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 750, () => {
                    if (this._button.has_style_class_name('countdown-flash'))
                        this._button.remove_style_class_name('countdown-flash');
                    else
                        this._button.add_style_class_name('countdown-flash');
                    return GLib.SOURCE_CONTINUE;
                });
            }
        } else {
            this._removeSource('_flashId');
            this._button.remove_style_class_name('countdown-flash');
        }
        this._syncSound();
        this._render();
    }

    _syncSound() {
        const audible = this._timer.status === 'expired' &&
            this._settings.get_boolean('sound-enabled');
        if (audible && !this._alarmId) {
            this._playSound();
            this._alarmId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
                this._playSound();
                return GLib.SOURCE_CONTINUE;
            });
        } else if (!audible) {
            this._removeSource('_alarmId');
            this._sound?.cancel();
            this._sound = null;
        }
    }

    _playSound() {
        this._sound?.cancel();
        this._sound = new Gio.Cancellable();
        try {
            global.display.get_sound_player().play_from_file(
                this.dir.get_child('alarm.wav'), 'Countdown finished', this._sound);
        } catch (error) {
            console.error(`Labelled Countdown: ${error.message}`);
        }
    }

    _render() {
        const status = this._timer.status;
        const label = this._settings.get_string('label').trim() || 'Timer';
        this._label.set_text(label);
        this._time.set_text(status === 'idle' ? '' : formatTime(this._timer.secondsLeft()));
        this._icon.icon_name = status === 'paused' ? 'media-playback-pause-symbolic' : 'alarm-symbolic';
        if (status === 'paused')
            this._button.add_style_class_name('countdown-paused');
        else
            this._button.remove_style_class_name('countdown-paused');
        this._button.accessible_name = `${label}: ${status === 'idle' ? 'ready' :
            `${this._time.get_text()}, ${status}`}`;
        this._startItem.label.set_text(status === 'idle' ? 'Start timer' : 'Restart timer');
        this._pauseItem.visible = status === 'running' || status === 'paused';
        this._pauseItem.label.set_text(status === 'paused' ? 'Resume' : 'Pause');
        this._resetItem.visible = status === 'running' || status === 'paused';
        this._dismissItem.visible = status === 'expired';
        this._validate();
    }

    _removeSource(property) {
        if (this[property])
            GLib.source_remove(this[property]);
        this[property] = 0;
    }

    disable() {
        this._removeSource('_tickId');
        this._removeSource('_flashId');
        this._removeSource('_alarmId');
        this._sound?.cancel();
        this._sound = null;
        if (this._settingsSignal)
            this._settings.disconnect(this._settingsSignal);
        this._settingsSignal = 0;
        this._button?.destroy();
        this._button = null;
        this._labelEntry = null;
        this._durationEntry = null;
        this._label = null;
        this._time = null;
        this._icon = null;
        this._startItem = null;
        this._pauseItem = null;
        this._resetItem = null;
        this._dismissItem = null;
        this._soundSwitch = null;
        this._help = null;
        this._timer = null;
        this._settings = null;
    }
}
