export const PlatformEventType = {
    SESSION_STARTED: 'session_started',
    SESSION_ENDED: 'session_ended',
    BUTTON_CLICKED: 'button_clicked',
    PAGE_VIEWED: 'page_viewed',
} as const;
export type PlatformEventType = (typeof PlatformEventType)[keyof typeof PlatformEventType];

export const GameEventType = {
    GAME_OPENED: 'game_opened',
    GAME_CLOSED: 'game_closed',
    MATCH_STARTED: 'match_started',
    MATCH_ENDED: 'match_ended',
    ACTION: 'action',
} as const;

export type GameEventType = (typeof GameEventType)[keyof typeof GameEventType];
export type EventType = GameEventType | PlatformEventType;
export type EventCategory = 'game' | 'platform';

export interface BaseEvent {
    id: string;
    deviceId: string;
    sessionId?: string;
    userId?: string;
    eventCategory: EventCategory;
    timestamp: number;
    metadata: Record<string, any>;
}

export interface GameEvent extends BaseEvent {
    type: GameEventType;
    eventCategory: 'game';
    gameId: string;
}

export interface PlatformEvent extends BaseEvent {
    type: PlatformEventType;
    eventCategory: 'platform';
}
export type EventUnion = GameEvent | PlatformEvent;