import { EventUnion } from "../event-generation/event.types";
import { config } from "../config";

export class EventService {

    async sendEvents(payload: EventUnion[]): Promise<void> {
        const response = await fetch(`${config.ingestorUrl}/ingest`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ events: payload })
        });
        if (!response.ok) { throw new Error('Failed to send events'); }
    }

}
