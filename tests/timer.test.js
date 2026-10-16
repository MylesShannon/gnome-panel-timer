import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Countdown, parseDuration, formatTime} from '../timer.js';

test('accepts minutes, minutes:seconds, and hours:minutes:seconds', () => {
    for (const [input, seconds] of [['25', 1500], [' 5 ', 300], ['0:03', 3],
        ['90:00', 5400], ['1:02:03', 3723], ['24:00:00', 86400]])
        assert.equal(parseDuration(input), seconds);
});

test('rejects zero, malformed input, and durations longer than a day', () => {
    for (const input of ['', '0', '0:00', '-5', '1.5', '5m', '1:60', '1:2',
        '1:60:00', '24:00:01', '1441', 'Infinity', '1:00:00:00'])
        assert.equal(parseDuration(input), null, input);
});

test('formats remaining time without going negative or hiding the last second', () => {
    for (const [seconds, text] of [[0, '00:00'], [-1, '00:00'], [0.1, '00:01'],
        [65, '01:05'], [3600, '1:00:00'], [86400, '24:00:00']])
        assert.equal(formatTime(seconds), text);
});

test('uses elapsed time, so late callbacks and suspend do not extend a countdown', () => {
    const timer = new Countdown();
    timer.start(60, 1000);
    assert.equal(timer.secondsLeft(1501), 60);
    assert.equal(timer.secondsLeft(51000), 10);
    assert.equal(timer.tick(100000), true);
    assert.equal(timer.status, 'expired');
    assert.equal(timer.secondsLeft(100000), 0);
    assert.equal(timer.tick(101000), false);
});

test('pause and resume preserve fractional seconds', () => {
    const timer = new Countdown();
    timer.start(10, 1000);
    timer.pause(2250);
    assert.equal(timer.status, 'paused');
    assert.equal(timer.secondsLeft(99999), 9);
    timer.resume(100000);
    assert.equal(timer.secondsLeft(107750), 1);
    assert.equal(timer.tick(108750), true);
});

test('pausing an overdue timer expires it instead of leaving it paused at zero', () => {
    const timer = new Countdown();
    timer.start(1, 1000);
    timer.pause(2001);
    assert.equal(timer.status, 'expired');
});

test('restores running, paused, and expired timers', () => {
    const timer = new Countdown();
    timer.start(10, 1000);
    const running = new Countdown(timer.serialize());
    assert.equal(running.secondsLeft(6000), 5);
    assert.equal(running.tick(12000), true);
    assert.equal(new Countdown(running.serialize()).status, 'expired');
    timer.pause(4000);
    const paused = new Countdown(timer.serialize());
    assert.equal(paused.status, 'paused');
    assert.equal(paused.secondsLeft(20000), 7);
});

test('invalid stored state safely becomes idle', () => {
    for (const value of ['garbage', 'null', '{}', '[]',
        '{"status":"running","deadline":-1,"remainingMs":0}',
        '{"status":"paused","deadline":0,"remainingMs":-10}',
        '{"status":"paused","deadline":0,"remainingMs":86400001}',
        '{"status":"running","deadline":"100","remainingMs":0}'])
        assert.equal(new Countdown(value).status, 'idle', value);
});

test('reset and restart discard the old countdown', () => {
    const timer = new Countdown();
    timer.start(1, 1000);
    timer.tick(2000);
    timer.reset();
    assert.equal(timer.status, 'idle');
    assert.equal(timer.secondsLeft(2000), 0);
    timer.start(20, 3000);
    assert.equal(timer.secondsLeft(4000), 19);
});

test('invalid start values do not replace a running countdown', () => {
    const timer = new Countdown();
    timer.start(30, 1000);
    for (const seconds of [0, -1, NaN, Infinity, 86401, 0.5])
        assert.throws(() => timer.start(seconds, 2000), RangeError);
    assert.equal(timer.secondsLeft(2000), 29);
});
