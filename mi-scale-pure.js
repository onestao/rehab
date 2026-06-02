var MI_SCALE_SERVICE_UUID = 0xFE95;
var MIN_PAYLOAD_LEN = 13;

function parseServiceData(bytes) {
    if (!bytes || bytes.length < MIN_PAYLOAD_LEN) return null;
    if (bytes.length > MIN_PAYLOAD_LEN) {
        bytes = bytes.slice(bytes.length - MIN_PAYLOAD_LEN);
    }
    if (bytes.length < MIN_PAYLOAD_LEN) return null;

    var ctrlByte1 = bytes[1];
    var isStabilized = (ctrlByte1 & (1 << 5)) !== 0;
    var hasImpedance = (ctrlByte1 & (1 << 1)) !== 0;

    var year = (bytes[2] & 0xFF) | ((bytes[3] & 0xFF) << 8);
    var month = bytes[4];
    var day = bytes[5];
    var hour = bytes[6];
    var minute = bytes[7];
    var second = bytes[8];

    var impedance = (bytes[10] << 8) + bytes[9];
    var weightRaw = ((bytes[12] & 0xFF) << 8) | (bytes[11] & 0xFF);
    var weight = weightRaw * 0.005;

    if (!Number.isFinite(weight) || weight <= 0) return null;

    var measuredAt = null;
    if (year >= 2000 && year <= 2099 && month >= 1 && month <= 12 &&
        day >= 1 && day <= 31 && hour >= 0 && hour <= 23 &&
        minute >= 0 && minute <= 59) {
        measuredAt = new Date(year, month - 1, day, hour, minute, second || 0);
        if (!Number.isFinite(measuredAt.getTime())) measuredAt = null;
    }

    return {
        weight: Math.round(weight * 100) / 100,
        stabilized: isStabilized,
        hasImpedance: hasImpedance,
        impedance: impedance,
        measuredAt: measuredAt,
        bmi: 0
    };
}

function computeBmi(weightKg, heightCm) {
    if (!weightKg || weightKg <= 0 || !heightCm || heightCm <= 0) return 0;
    var hm = heightCm / 100;
    return Math.round((weightKg / (hm * hm)) * 10) / 10;
}

if (typeof window !== 'undefined') {
    window.miScalePure = {
        MI_SCALE_SERVICE_UUID: MI_SCALE_SERVICE_UUID,
        parseServiceData: parseServiceData,
        computeBmi: computeBmi
    };
}

export { MI_SCALE_SERVICE_UUID, parseServiceData, computeBmi };
