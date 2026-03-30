import { EventService } from "../services/event.service";
import { EventQueue } from "./event.queue";

export class EventVisitor {
    eventQueue: EventQueue;
    eventService: EventService;

    constructor(eventQueue: EventQueue, eventService: EventService, visitInterval = 5000) {
        this.eventQueue = eventQueue;
        this.eventService = eventService;
        setInterval(this.visit.bind(this), visitInterval);
    }
    visit() {
        const events = this.eventQueue.flush();
        if (events.length > 0) {
            this.eventService.sendEvent(events);
        }
    }
}
