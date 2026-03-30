import { GameEventType } from "./event.types";
import { EventQueue } from "./event.queue";

export class EventMockPipe {
    private eventQueue: EventQueue;
    private gameId: string;
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private eventsPerSecond: number;

    constructor(eventQueue: EventQueue, gameId: string, eventsPerSecond = 10) {
        this.eventQueue = eventQueue;
        this.gameId = gameId;
        this.eventsPerSecond = eventsPerSecond;
    }

    start() {
        if (this.intervalId) return;

        this.eventQueue.enqueueGameEvent(GameEventType.GAME_STARTED, this.gameId, {
            mode: 'ranked',
        });

        const intervalMs = 1000 / this.eventsPerSecond;
        this.intervalId = setInterval(() => {
            this.eventQueue.enqueueGameEvent(GameEventType.ACTION, this.gameId, {
                actionType: 'move',
                x: Math.floor(Math.random() * 100),
                y: Math.floor(Math.random() * 100),
            });
        }, intervalMs);
    }

    stop() {
        if (!this.intervalId) return;

        clearInterval(this.intervalId);
        this.intervalId = null;

        this.eventQueue.enqueueGameEvent(GameEventType.GAME_COMPLETED, this.gameId, {
            result: 'win',
            score: Math.floor(Math.random() * 1000),
        });
    }

    isRunning(): boolean {
        return this.intervalId !== null;
    }
}
