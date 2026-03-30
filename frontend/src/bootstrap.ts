import { EventQueue } from "./event-generation/event.queue";
import { EventVisitor } from "./event-generation/event.visitor";
import { AuthService } from "./services/auth.service";
import { DeviceService } from "./services/device.service";
import { EventService } from "./services/event.service";

export const deviceService = new DeviceService();
export const authService = new AuthService();
export const eventQueue = new EventQueue(deviceService, authService);
export const eventService = new EventService();
export const eventVisitor = new EventVisitor(eventQueue, eventService);
