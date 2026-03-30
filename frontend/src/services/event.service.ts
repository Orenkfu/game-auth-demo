import { EventUnion } from "../event-generation/event.types";

const BACKEND_URL = 'http://localhost:3002';


export class EventService {

    async sendEvent(payload: EventUnion[]): Promise<void> {
        const response = await fetch(`${BACKEND_URL}/ingest`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ events: payload })
        });
        if (!response.ok) { throw new Error('Failed to send event'); }
    }

}