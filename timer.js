const MAX_SECONDS = 86400;

export function parseDuration(text) {
    const value = text.trim();
    if (!/^\d+(?::[0-5]\d){0,2}$/.test(value))
        return null;
    const parts = value.split(':').map(Number);
    const seconds = parts.length === 1
        ? parts[0] * 60
        : parts.reduce((total, part) => total * 60 + part, 0);
    return Number.isSafeInteger(seconds) && seconds > 0 && seconds <= MAX_SECONDS
        ? seconds : null;
}

export function formatTime(seconds) {
    const value = Math.max(0, Math.ceil(seconds));
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor(value % 3600 / 60).toString().padStart(2, '0');
    const remainder = (value % 60).toString().padStart(2, '0');
    return hours ? `${hours}:${minutes}:${remainder}` : `${minutes}:${remainder}`;
}

export class Countdown {
    constructor(saved = '') {
        this.reset();
        try {
            const state = JSON.parse(saved);
            if (!state || !['idle', 'running', 'paused', 'expired'].includes(state.status) ||
                !Number.isSafeInteger(state.deadline) || state.deadline < 0 ||
                !Number.isSafeInteger(state.remainingMs) || state.remainingMs < 0 ||
                state.remainingMs > MAX_SECONDS * 1000 ||
                (state.status === 'running' && state.deadline === 0) ||
                (state.status === 'paused' && state.remainingMs === 0))
                return;
            this.status = state.status;
            this.deadline = state.deadline;
            this.remainingMs = state.remainingMs;
        } catch {
            this.reset();
        }
    }

    start(seconds, now = Date.now()) {
        if (!Number.isSafeInteger(seconds) || seconds <= 0 || seconds > MAX_SECONDS)
            throw new RangeError('Duration must be between 1 second and 24 hours');
        this.status = 'running';
        this.deadline = now + seconds * 1000;
        this.remainingMs = 0;
    }

    secondsLeft(now = Date.now()) {
        if (this.status === 'running')
            return Math.max(0, Math.ceil((this.deadline - now) / 1000));
        return this.status === 'paused' ? Math.ceil(this.remainingMs / 1000) : 0;
    }

    tick(now = Date.now()) {
        if (this.status !== 'running' || now < this.deadline)
            return false;
        this.status = 'expired';
        this.deadline = 0;
        return true;
    }

    pause(now = Date.now()) {
        if (this.status !== 'running' || this.tick(now))
            return;
        this.remainingMs = this.deadline - now;
        this.deadline = 0;
        this.status = 'paused';
    }

    resume(now = Date.now()) {
        if (this.status !== 'paused')
            return;
        this.deadline = now + this.remainingMs;
        this.remainingMs = 0;
        this.status = 'running';
    }

    reset() {
        this.status = 'idle';
        this.deadline = 0;
        this.remainingMs = 0;
    }

    serialize() {
        return JSON.stringify({status: this.status, deadline: this.deadline,
            remainingMs: this.remainingMs});
    }
}
