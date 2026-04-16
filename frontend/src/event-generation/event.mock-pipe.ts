import { GameEventType } from "./event.types";
import { EventQueue } from "./event.queue";
import { GAME_RULES, GameActionType, GameRuleset } from "./game-rules";

export type PipeState = 'idle' | 'streaming' | 'closed';

export class EventMockPipe {
    private eventQueue: EventQueue;
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private _eventsPerSecond: number;
    private _state: PipeState = 'idle';
    private ruleset: GameRuleset;

    readonly gameId: string;

    constructor(eventQueue: EventQueue, gameId: string, eventsPerSecond = 10) {
        this.eventQueue = eventQueue;
        this.gameId = gameId;
        this._eventsPerSecond = eventsPerSecond;
        this.ruleset = GAME_RULES[gameId] ?? GAME_RULES['League of Legends'];

        this.eventQueue.enqueueGameEvent(GameEventType.GAME_OPENED, this.gameId);
    }

    get state(): PipeState {
        return this._state;
    }

    get eventsPerSecond(): number {
        return this._eventsPerSecond;
    }

    startMatch() {
        if (this._state !== 'idle') return;

        this.eventQueue.enqueueGameEvent(GameEventType.MATCH_STARTED, this.gameId, {
            mode: 'ranked',
            playerCount: this.ruleset.playerCount,
        });

        this._state = 'streaming';
        this.startInterval();
    }

    endMatch() {
        if (this._state !== 'streaming') return;

        this.clearInterval();
        this.eventQueue.enqueueGameEvent(GameEventType.MATCH_ENDED, this.gameId, {
            result: ['win', 'loss'][Math.floor(Math.random() * 2)],
        });

        this._state = 'idle';
    }

    setRate(eventsPerSecond: number) {
        this._eventsPerSecond = eventsPerSecond;
        if (this._state === 'streaming') {
            this.clearInterval();
            this.startInterval();
        }
    }

    close() {
        if (this._state === 'closed') return;

        if (this._state === 'streaming') {
            this.endMatch();
        }

        this.eventQueue.enqueueGameEvent(GameEventType.GAME_CLOSED, this.gameId);
        this._state = 'closed';
    }

    private startInterval() {
        const intervalMs = 1000 / this._eventsPerSecond;
        this.intervalId = setInterval(() => this.emitGameAction(), intervalMs);
    }

    private emitGameAction() {
        const action = this.pickWeightedAction();
        const metadata = action.metadata();

        this.eventQueue.enqueueGameEvent(GameEventType.ACTION, this.gameId, {
            actionName: action.name,
            ...metadata,
        });

        if (action.followUps) {
            for (const followUp of action.followUps) {
                this.eventQueue.enqueueGameEvent(GameEventType.ACTION, this.gameId, {
                    actionName: followUp.actionName,
                    ...followUp.metadata(metadata),
                });
            }
        }
    }

    private pickWeightedAction(): GameActionType {
        const actions = this.ruleset.actions;
        const totalWeight = actions.reduce((sum, a) => sum + a.weight, 0);
        let roll = Math.random() * totalWeight;

        for (const action of actions) {
            roll -= action.weight;
            if (roll <= 0) return action;
        }

        return actions[actions.length - 1];
    }

    private clearInterval() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}
