// @ts-nocheck
(function () {
    var SCAN_TIMEOUT_MS = 30000;
    var BODY_COMP_SERVICE = '0000181b-0000-1000-8000-00805f9b34fb';
    var BODY_COMP_CHAR = '00002a9c-0000-1000-8000-00805f9b34fb';
    var MI_SERVICE_128 = '0000fe95-0000-1000-8000-00805f9b34fb';
    var SCALE_NAMES = ['MIBCS', 'MIBFS', 'MI SCALE', 'MI_SCALE'];

    function supportInfo() {
        if (typeof navigator === 'undefined') {
            return { ok: false, reason: '当前环境没有浏览器蓝牙能力' };
        }
        if (typeof window !== 'undefined' && window.isSecureContext === false) {
            return { ok: false, reason: 'Web Bluetooth 需要 HTTPS 或 localhost。请用 HTTPS 地址打开，局域网 HTTP 会被 Android Chrome 禁用蓝牙 API。' };
        }
        if (!navigator.bluetooth) {
            return { ok: false, reason: '当前页面没有 navigator.bluetooth。请确认使用 Android Chrome（不是微信/QQ/WebView），并允许蓝牙权限。' };
        }
        return { ok: true, reason: '' };
    }

    function isSupported() {
        return supportInfo().ok;
    }

    function isScaleDevice(device) {
        if (!device || !device.name) return false;
        var n = device.name.toUpperCase();
        return SCALE_NAMES.some(function (prefix) { return n.startsWith(prefix) || n === prefix; });
    }

    function parseScaleBytes(bytes, miScale) {
        if (!bytes || bytes.length < 13) return null;
        return miScale.parseServiceData(bytes);
    }

    function parseGattValue(dv, miScale) {
        var bytes = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
        return parseScaleBytes(bytes, miScale);
    }

    function scan(onReading, onError) {
        var support = supportInfo();
        if (!support.ok) {
            if (onError) onError(new Error(support.reason || '此浏览器不支持 Web Bluetooth'));
            return null;
        }
        var miScale = window.miScalePure;
        if (!miScale) {
            if (onError) onError(new Error('体重秤解析模块未加载'));
            return null;
        }

        var aborted = false;
        var timer = null;
        var connectedDevice = null;
        var activeScan = null;

        function cleanup() {
            if (timer) { clearTimeout(timer); timer = null; }
            if (activeScan && typeof activeScan.stop === 'function') {
                try { activeScan.stop(); } catch (_) {}
                activeScan = null;
            }
            if (connectedDevice && connectedDevice.gatt && connectedDevice.gatt.connected) {
                try { connectedDevice.gatt.disconnect(); } catch (_) {}
            }
        }

        function deliverResult(result, sourceId) {
            if (aborted) return;
            if (!result || !result.stabilized) return;
            cleanup();
            onReading(result, sourceId || '');
        }

        function onAdvReceived(ev) {
            if (aborted) return;
            if (!isScaleDevice(ev.device)) return;
            var sd = ev.serviceData;
            if (!sd) return;
            var val = sd.get(MI_SERVICE_128) || sd.get(miScale.MI_SCALE_SERVICE_UUID);
            if (!val || val.byteLength < 13) return;
            var result = parseScaleBytes(new Uint8Array(val.buffer, val.byteOffset, val.byteLength), miScale);
            deliverResult(result, ev.device.id || ev.device.name || '');
        }

        function tryScanApi() {
            if (typeof navigator.bluetooth.requestLEScan !== 'function') return Promise.resolve(false);
            return navigator.bluetooth.requestLEScan({
                acceptAllAdvertisements: true,
                keepRepeatedDevices: true
            })
                .then(function (scanObj) {
                    if (aborted) { scanObj.stop(); return true; }
                    activeScan = scanObj;
                    navigator.bluetooth.addEventListener('advertisementreceived', onAdvReceived);
                    return true;
                })
                .catch(function () { return false; });
        }

        function tryGattConnection(device) {
            connectedDevice = device;
            return device.gatt.connect()
                .then(function (server) {
                    if (aborted) return;
                    return server.getPrimaryService(BODY_COMP_SERVICE);
                })
                .then(function (service) {
                    if (aborted) return;
                    return service.getCharacteristic(BODY_COMP_CHAR);
                })
                .then(function (ch) {
                    if (aborted) return;
                    if (ch.properties.notify) {
                        return ch.startNotifications().then(function () {
                            return new Promise(function (resolve) {
                                ch.addEventListener('characteristicvaluechanged', function handler(ev) {
                                    ch.removeEventListener('characteristicvaluechanged', handler);
                                    if (aborted) { resolve(); return; }
                                    var result = parseGattValue(ev.target.value, miScale);
                                    deliverResult(result, device.id || device.name || '');
                                    resolve();
                                });
                            });
                        });
                    }
                    return ch.readValue().then(function (dv) {
                        if (aborted) return;
                        var result = parseGattValue(dv, miScale);
                        deliverResult(result, device.id || device.name || '');
                    });
                })
                .catch(function () {});
        }

        function tryRequestDevice() {
            return navigator.bluetooth.requestDevice({
                filters: SCALE_NAMES.map(function (n) { return { name: n }; }),
                optionalServices: [BODY_COMP_SERVICE]
            })
                .then(function (device) {
                    if (aborted) return;
                    if (typeof device.watchAdvertisements === 'function') {
                        device.addEventListener('advertisementreceived', onAdvReceived);
                        device.watchAdvertisements().catch(function () {});
                    }
                    return tryGattConnection(device);
                })
                .catch(function (err) {
                    if (aborted) return;
                    if (err && err.name === 'NotFoundError') {
                        if (onError) onError(new Error('未找到设备。请确认秤已开机并站在秤上（秤在无人时不广播蓝牙）。'));
                    } else if (err) {
                        if (onError) onError(err);
                    }
                });
        }

        tryScanApi().then(function (scanned) {
            if (aborted) return;
            if (!scanned) {
                return tryRequestDevice();
            }
        });

        timer = setTimeout(function () {
            aborted = true;
            cleanup();
            if (onError) onError(new Error('扫描超时。请站在秤上并保持 30 秒内完成称重，秤在无人时不会广播蓝牙。'));
        }, SCAN_TIMEOUT_MS);

        return {
            cancel: function () {
                aborted = true;
                cleanup();
            }
        };
    }

    var api = {
        isSupported: isSupported,
        supportInfo: supportInfo,
        scan: scan
    };

    if (typeof window !== 'undefined') window.miScaleBluetooth = api;
})();
