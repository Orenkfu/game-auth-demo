import { EventMockPipe } from './event.mock-pipe';
import { EventQueue } from './event.queue';
import { GameEventType } from './event.types';

const mockDeviceService = { getDeviceId: () => 'device-123' };
const mockAuthService = {
    getSessionToken: () => 'token-abc',
    getProfileId: () => 'profile-456',
};

function createQueue() {
    return new EventQueue(mockDeviceService as any, mockAuthService as any);
}

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.useRealTimers();
});

describe('EventMockPipe', () => {
    describe('construction', () => {
        it('should emit game_opened on creation', () => {
            const queue = createQueue();
            new EventMockPipe(queue, 'League of Legends');

            const events = queue.flush();
            expect(events).toHaveLength(1);
            expect(events[0].type).toBe(GameEventType.GAME_OPENED);
            expect('gameId' in events[0] && events[0].gameId).toBe('League of Legends');
        });

        it('should start in idle state', () => {
            const queue = createQueue();
            const pipe = new EventMockPipe(queue, 'Valorant');
            expect(pipe.state).toBe('idle');
        });
    });

    describe('state machine', () => {
        it('should transition idle → streaming on startMatch', () => {
            const queue = createQueue();
            const pipe = new EventMockPipe(queue, 'CS2');
            queue.flush(); // clear game_opened

            pipe.startMatch();
            expect(pipe.state).toBe('streaming');

            const events = queue.flush();
            expect(events[0].type).toBe(GameEventType.MATCH_STARTED);
        });

        it('should transition streaming → idle on endMatch', () => {
            const queue = createQueue();
            const pipe = new EventMockPipe(queue, 'Valorant');
            queue.flush();

            pipe.startMatch();
            queue.flush();

            pipe.endMatch();
            expect(pipe.state).toBe('idle');

            const events = queue.flush();
            expect(events[0].type).toBe(GameEventType.MATCH_ENDED);
        });

        it('should transition idle → closed on close', () => {
            const queue = createQueue();
            const pipe = new EventMockPipe(queue, 'TFT');
            queue.flush();

            pipe.close();
            expect(pipe.state).toBe('closed');

            const events = queue.flush();
            expect(events[0].type).toBe(GameEventType.GAME_CLOSED);
        });

        it('should auto-end match when closing during streaming', () => {
            const queue = createQueue();
            const pipe = new EventMockPipe(queue, 'Fortnite');
            queue.flush();

            pipe.startMatch();
            queue.flush();

            pipe.close();
            expect(pipe.state).toBe('closed');

            const events = queue.flush();
            const types = events.map(e => e.type);
            expect(types).toContain(GameEventType.MATCH_ENDED);
            expect(types).toContain(GameEventType.GAME_CLOSED);
        });

        it('should not allow startMatch when already streaming', () => {
            const queue = createQueue();
            const pipe = new EventMockPipe(queue, 'CS2');
            queue.flush();

            pipe.startMatch();
            queue.flush();

            pipe.startMatch(); // no-op
            const events = queue.flush();
            expect(events.every(e => e.type !== GameEventType.MATCH_STARTED)).toBe(true);
        });

        it('should not allow endMatch when idle', () => {
            const queue = createQueue();
            const pipe = new EventMockPipe(queue, 'Valorant');
            queue.flush();

            pipe.endMatch(); // no-op
            const events = queue.flush();
            expect(events).toHaveLength(0);
        });

        it('should not allow close when already closed', () => {
            const queue = createQueue();
            const pipe = new EventMockPipe(queue, 'TFT');
            queue.flush();

            pipe.close();
            queue.flush();

            pipe.close(); // no-op
            const events = queue.flush();
            expect(events).toHaveLength(0);
        });

        it('should support multiple matches in one game session', () => {
            const queue = createQueue();
            const pipe = new EventMockPipe(queue, 'League of Legends');
            queue.flush();

            pipe.startMatch();
            pipe.endMatch();
            queue.flush();

            pipe.startMatch();
            expect(pipe.state).toBe('streaming');
            pipe.endMatch();

            const events = queue.flush();
            const types = events.map(e => e.type);
            expect(types.filter(t => t === GameEventType.MATCH_STARTED)).toHaveLength(1);
            expect(types.filter(t => t === GameEventType.MATCH_ENDED)).toHaveLength(1);
        });
    });

    describe('event generation', () => {
        it('should emit ACTION events at configured rate', () => {
            const queue = createQueue();
            const pipe = new EventMockPipe(queue, 'League of Legends', 10);
            queue.flush();

            pipe.startMatch();
            queue.flush(); // clear match_started

            jest.advanceTimersByTime(1000);

            const events = queue.flush();
            // 10 events/sec = 100ms interval, in 1000ms we get ~10 actions
            // Each action may produce follow-ups, so count only primary + followups
            expect(events.length).toBeGreaterThanOrEqual(10);
            expect(events.every(e => e.type === GameEventType.ACTION)).toBe(true);

            pipe.endMatch();
        });

        it('should stop emitting events after endMatch', () => {
            const queue = createQueue();
            const pipe = new EventMockPipe(queue, 'Valorant', 10);
            queue.flush();

            pipe.startMatch();
            queue.flush();

            pipe.endMatch();
            queue.flush(); // clear match_ended

            jest.advanceTimersByTime(1000);
            const events = queue.flush();
            expect(events).toHaveLength(0);
        });

        it('should change rate when setRate is called during streaming', () => {
            const queue = createQueue();
            const pipe = new EventMockPipe(queue, 'CS2', 1);
            queue.flush();

            pipe.startMatch();
            queue.flush();

            // At 1/sec, 500ms should produce 0 events
            jest.advanceTimersByTime(500);
            expect(queue.flush().length).toBe(0);

            // Change to 10/sec
            pipe.setRate(10);
            jest.advanceTimersByTime(500);
            const events = queue.flush();
            expect(events.length).toBeGreaterThanOrEqual(4);

            pipe.endMatch();
        });
    });

    describe('game-specific events', () => {
        it('should generate events with actionName in metadata', () => {
            const queue = createQueue();
            const pipe = new EventMockPipe(queue, 'League of Legends', 10);
            queue.flush();

            pipe.startMatch();
            queue.flush();

            jest.advanceTimersByTime(1000);
            const events = queue.flush();

            for (const event of events) {
                expect(event.metadata.actionName).toBeDefined();
                expect(typeof event.metadata.actionName).toBe('string');
            }

            pipe.endMatch();
        });

        it('should use correct ruleset for game', () => {
            const queue = createQueue();
            const pipe = new EventMockPipe(queue, 'Valorant', 100);
            queue.flush();

            pipe.startMatch();
            queue.flush();

            jest.advanceTimersByTime(2000);
            const events = queue.flush();

            const actionNames = events.map(e => e.metadata.actionName);
            const valorantActions = ['player_killed', 'death', 'ability_used', 'spike_planted', 'round_ended'];
            for (const name of actionNames) {
                expect(valorantActions).toContain(name);
            }

            pipe.endMatch();
        });

        it('should fall back to League of Legends for unknown games', () => {
            const queue = createQueue();
            const pipe = new EventMockPipe(queue, 'Unknown Game', 100);
            queue.flush();

            pipe.startMatch();
            queue.flush();

            jest.advanceTimersByTime(1000);
            const events = queue.flush();

            const actionNames = events.map(e => e.metadata.actionName);
            const lolActions = ['player_killed', 'death', 'gold_earned', 'item_purchased', 'turret_destroyed', 'dragon_slain'];
            for (const name of actionNames) {
                expect(lolActions).toContain(name);
            }

            pipe.endMatch();
        });
    });

    describe('follow-up causality', () => {
        it('player_killed should produce death with matching actorId/targetId', () => {
            const queue = createQueue();
            const pipe = new EventMockPipe(queue, 'League of Legends', 200);
            queue.flush();

            pipe.startMatch();
            queue.flush();

            // Generate lots of events to get player_killed + follow-ups
            jest.advanceTimersByTime(5000);
            const events = queue.flush();

            // Find player_killed events and their follow-ups
            for (let i = 0; i < events.length; i++) {
                if (events[i].metadata.actionName === 'player_killed') {
                    const kill = events[i];
                    const death = events[i + 1];
                    const goldEarned = events[i + 2];

                    if (death && death.metadata.actionName === 'death') {
                        // The victim (death.actorId) should be the kill's targetId
                        expect(death.metadata.actorId).toBe(kill.metadata.targetId);
                        // The killer should match
                        expect(death.metadata.killedBy).toBe(kill.metadata.actorId);
                    }

                    if (goldEarned && goldEarned.metadata.actionName === 'gold_earned') {
                        // Gold goes to the killer
                        expect(goldEarned.metadata.actorId).toBe(kill.metadata.actorId);
                        expect(goldEarned.metadata.source).toBe('kill');
                    }
                }
            }

            pipe.endMatch();
        });

        it('turret_destroyed should produce gold_earned for the actor', () => {
            const queue = createQueue();
            // Use a custom approach - we'll just verify the structure
            const pipe = new EventMockPipe(queue, 'League of Legends', 200);
            queue.flush();

            pipe.startMatch();
            queue.flush();

            jest.advanceTimersByTime(10000);
            const events = queue.flush();

            for (let i = 0; i < events.length; i++) {
                if (events[i].metadata.actionName === 'turret_destroyed') {
                    const turret = events[i];
                    const gold = events[i + 1];

                    if (gold && gold.metadata.actionName === 'gold_earned') {
                        expect(gold.metadata.actorId).toBe(turret.metadata.actorId);
                        expect(gold.metadata.source).toBe('turret');
                        expect(gold.metadata.value).toBe(250);
                    }
                }
            }

            pipe.endMatch();
        });
    });
});
