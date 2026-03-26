import axios from "axios";
import https from "https";
import config from "../../config/index.js";

export async function getDeviceByMac(mac) {
    const url = `${config.UNIFI_URL}/proxy/network/integration/v1/sites/88f7af54-98f8-306a-a1c7-c9349722b1f6/devices`;

    try {
        const res = await axios.get(url, {
            headers: {
                "Accept": "application/json",
                "X-API-KEY": config.UNIFI_API_KEY
            },
            httpsAgent: new https.Agent({
                rejectUnauthorized: false
            })
        });

        const devices = res.data.data || [];
        const macNormalized = mac.toLowerCase();

        const device = devices.find(
            d => d.macAddress?.toLowerCase() === macNormalized
        );

        if (!device) {
            console.log(`⚠️ Device with MAC ${mac} not found in API.`);
            return null;
        }

        return {
            id: device.id,
            name: device.name,
            model: device.model,
            mac: device.macAddress,
            ip: device.ipAddress,
            state: device.state
        };

    } catch (err) {
        console.error("❌ Failed to fetch UniFi device info:", err.message);
        return null;
    }
}
