import { EventQueue } from './event.queue';
import { GameEventType, PlatformEventType } from './event.types';

const mockDeviceService = { getDeviceId: () => 'device-123' };
const mockAuthService = {
    getSessionToken: () => 'token-abc',
    getProfileId: () => 'profile-456',
};

function createQueue(maxSize = 10000) {
    return new EventQueue(mockDeviceService as any, mockAuthService as any, maxSize);
}

describe('EventQueue', () => {
    describe('enqueueGameEvent', () => {
        it('should create a game event with correct fields', () => {
            const queue = createQueue();
            queue.enqueueGameEvent(GameEventType.GAME_OPENED, 'League of Legends');

            const events = queue.flush();
            expect(events).toHaveLength(1);

            const event = events[0];
            expect(event.id).toBeDefined();
            expect(event.deviceId).toBe('device-123');
            expect(event.sessionId).toBe('token-abc');
            expect(event.userId).toBe('profile-456');
            expect(event.eventCategory).toBe('game');
            expect(event.timestamp).toBeGreaterThan(0);
            expect(event.type).toBe('game_opened');
            expect('gameId' in event && event.gameId).toBe('League of Legends');
        });

        it('should include metadata when provided', () => {
            const queue = createQueue();
            queue.enqueueGameEvent(GameEventType.ACTION, 'Valorant', {
                actionName: 'player_killed',
                actorId: 'player_1',
            });

            const events = queue.flush();
            expect(events[0].metadata).toEqual({
                actionName: 'player_killed',
                actorId: 'player_1',
            });
        });

        it('should default metadata to empty object', () => {
            const queue = createQueue();
            queue.enqueueGameEvent(GameEventType.GAME_OPENED, 'CS2');

            const events = queue.flush();
            expect(events[0].metadata).toEqual({});
        });
    });

    describe('enqueuePlatformEvent', () => {
        it('should create a platform event with correct fields', () => {
            const queue = createQueue();
            queue.enqueuePlatformEvent(PlatformEventType.SESSION_STARTED);

            const events = queue.flush();
            expect(events).toHaveLength(1);
            expect(events[0].eventCategory).toBe('platform');
            expect(events[0].type).toBe('session_started');
        });
    });

    describe('flush', () => {
        it('should return all events and clear the queue', () => {
            const queue = createQueue();
            queue.enqueueGameEvent(GameEventType.GAME_OPENED, 'TFT');
            queue.enqueueGameEvent(GameEventType.MATCH_STARTED, 'TFT');

            const events = queue.flush();
            expect(events).toHaveLength(2);

            const secondFlush = queue.flush();
            expect(secondFlush).toHaveLength(0);
        });

        it('should return empty array when queue is empty', () => {
            const queue = createQueue();
            expect(queue.flush()).toEqual([]);
        });
    });

    describe('overflow', () => {
        it('should throw when queue is full', () => {
            const queue = createQueue(2);
            queue.enqueueGameEvent(GameEventType.ACTION, 'CS2');
            queue.enqueueGameEvent(GameEventType.ACTION, 'CS2');

            expect(() => {
                queue.enqueueGameEvent(GameEventType.ACTION, 'CS2');
            }).toThrow('Event queue is full');
        });
    });

    describe('auth state', () => {
        it('should omit sessionId and userId when not authenticated', () => {
            const noAuthService = {
                getSessionToken: (): string | null => null,
                getProfileId: (): string | null => null,
            };
            const queue = new EventQueue(mockDeviceService as any, noAuthService as any);
            queue.enqueueGameEvent(GameEventType.GAME_OPENED, 'Valorant');

            const events = queue.flush();
            expect(events[0].sessionId).toBeUndefined();
            expect(events[0].userId).toBeUndefined();
        });
    });

    describe('unique IDs', () => {
        it('should generate unique IDs for each event', () => {
            const queue = createQueue();
            queue.enqueueGameEvent(GameEventType.ACTION, 'CS2');
            queue.enqueueGameEvent(GameEventType.ACTION, 'CS2');
            queue.enqueueGameEvent(GameEventType.ACTION, 'CS2');

            const events = queue.flush();
            const ids = events.map(e => e.id);
            expect(new Set(ids).size).toBe(3);
        });
    });
});
