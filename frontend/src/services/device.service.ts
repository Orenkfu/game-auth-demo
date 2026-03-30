import { v4 } from "uuid";

const DEVICE_ID_KEY = 'outplayed_device_id';

export class DeviceService {
    private deviceId: string;

    constructor() {
        this.deviceId = this.loadOrCreate();
    }

    getDeviceId(): string {
        return this.deviceId;
    }

    private loadOrCreate(): string {
        const existing = localStorage.getItem(DEVICE_ID_KEY);
        if (existing) return existing;

        const deviceId = v4();
        localStorage.setItem(DEVICE_ID_KEY, deviceId);
        return deviceId;
    }
}
