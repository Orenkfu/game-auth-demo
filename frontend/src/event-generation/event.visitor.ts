import { EventService } from "../renderer/services/event.service";
import { EventQueue } from "./event.queue";

export class EventVisitor {
    private eventQueue: EventQueue;
    private eventService: EventService;
    private intervalId: ReturnType<typeof setInterval> | null = null;

    constructor(eventQueue: EventQueue, eventService: EventService, visitInterval = 5000) {
        this.eventQueue = eventQueue;
        this.eventService = eventService;
        this.intervalId = setInterval(() => this.visit(), visitInterval);
    }

    visit() {
        const events = this.eventQueue.flush();
        if (events.length > 0) {
            this.eventService.sendEvents(events);
        }
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.visit();
    }
}
