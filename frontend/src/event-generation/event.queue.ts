import { EventUnion, GameEvent, GameEventType, PlatformEvent, PlatformEventType } from "./event.types";
import { DeviceService } from "../renderer/services/device.service";
import { AuthService } from "../renderer/services/auth.service";
import { v4 } from "uuid";

export class EventQueue {
    private queue: EventUnion[];
    private maxSize: number;
    private deviceService: DeviceService;
    private authService: AuthService;

    constructor(deviceService: DeviceService, authService: AuthService, maxSize = 10000) {
        this.maxSize = maxSize;
        this.queue = [];
        this.deviceService = deviceService;
        this.authService = authService;
    }

    enqueueGameEvent(type: GameEventType, gameId: string, metadata: Record<string, any> = {}) {
        const event: GameEvent = {
            ...this.buildBase('game'),
            type,
            gameId,
            metadata,
        };
        this.enqueue(event);
    }

    enqueuePlatformEvent(type: PlatformEventType, metadata: Record<string, any> = {}) {
        const event: PlatformEvent = {
            ...this.buildBase('platform'),
            type,
            metadata,
        };
        this.enqueue(event);
    }

    flush(): EventUnion[] {
        const eventsToFlush = [...this.queue];
        this.queue = [];
        return eventsToFlush;
    }

    private buildBase<T extends 'game' | 'platform'>(eventCategory: T) {
        return {
            id: v4(),
            deviceId: this.deviceService.getDeviceId(),
            sessionId: this.authService.getSessionToken() || undefined,
            userId: this.authService.getProfileId() || undefined,
            eventCategory,
            timestamp: Date.now(),
        } as { id: string; deviceId: string; sessionId?: string; userId?: string; eventCategory: T; timestamp: number };
    }

    private enqueue(event: EventUnion) {
        if (this.queue.length >= this.maxSize) {
            throw new Error('Event queue is full');
        }
        this.queue.push(event);
    }
}
