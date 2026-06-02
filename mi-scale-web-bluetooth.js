// @ts-nocheck
(function () {
    var SCAN_TIMEOUT_MS = 30000;

    function supportInfo() {
        if (typeof navigator === 'undefined') {
            return { ok: false, reason: '当前环境没有浏览器蓝牙能力' };
        }
        if (typeof window !== 'undefined' && window.isSecureContext === false) {
            return { ok: false, reason: 'Web Bluetooth 需要 HTTPS 或 localhost。请用 HTTPS 地址打开，局域网 HTTP/IP 地址会被 Android Chrome 禁用蓝牙 API。' };
        }
        if (!navigator.bluetooth) {
            return { ok: false, reason: '当前页面没有 navigator.bluetooth。请确认使用 Android Chrome，而不是微信/QQ/系统 WebView/其它内置浏览器，并允许网站使用蓝牙。' };
        }
        return { ok: true, reason: '' };
    }

    function isSupported() {
        return supportInfo().ok;
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

        function cleanup() {
            if (timer) { clearTimeout(timer); timer = null; }
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

        function watchAdv(device) {
            if (typeof device.watchAdvertisements !== 'function') return false;
            var handler = function (ev) {
                device.removeEventListener('advertisementreceived', handler);
                if (aborted) return;
                var sd = ev.serviceData;
                if (!sd) return;
                var val = sd.get(miScale.MI_SCALE_SERVICE_UUID);
                if (!val || val.byteLength < 13) return;
                var result = miScale.parseServiceData(new Uint8Array(val.buffer, val.byteOffset, val.byteLength));
                deliverResult(result, device.id || device.name || '');
            };
            device.addEventListener('advertisementreceived', handler);
            device.watchAdvertisements().catch(function () {});
            return true;
        }

        function readFromGatt(device) {
            connectedDevice = device;
            return device.gatt.connect()
                .then(function (server) {
                    if (aborted) return;
                    return server.getPrimaryService(miScale.MI_SCALE_SERVICE_UUID);
                })
                .then(function (service) {
                    if (aborted) return;
                    return service.getCharacteristics();
                })
                .then(function (chars) {
                    if (aborted || !chars || !chars.length) return;
                    var ch = chars[0];
                    if (ch.properties.notify) {
                        return ch.startNotifications().then(function () {
                            return new Promise(function (resolve) {
                                ch.addEventListener('characteristicvaluechanged', function handler(ev) {
                                    ch.removeEventListener('characteristicvaluechanged', handler);
                                    if (aborted) { resolve(); return; }
                                    var dv = ev.target.value;
                                    var result = miScale.parseServiceData(new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength));
                                    deliverResult(result, device.id || device.name || '');
                                    resolve();
                                });
                            });
                        });
                    }
                    return ch.readValue().then(function (dv) {
                        if (aborted) return;
                        var result = miScale.parseServiceData(new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength));
                        deliverResult(result, device.id || device.name || '');
                    });
                })
                .catch(function () {});
        }

        navigator.bluetooth.requestDevice({
            filters: [{ services: [miScale.MI_SCALE_SERVICE_UUID] }],
            optionalServices: [miScale.MI_SCALE_SERVICE_UUID]
        })
            .then(function (device) {
                if (aborted) return;
                watchAdv(device);
                return readFromGatt(device);
            })
            .catch(function (err) {
                if (aborted) return;
                if (err && err.name === 'NotFoundError') {
                    if (onError) onError(new Error('未找到设备或已取消'));
                } else if (err) {
                    if (onError) onError(err);
                }
            });

        timer = setTimeout(function () {
            aborted = true;
            cleanup();
            if (onError) onError(new Error('扫描超时，请站在秤上后重试'));
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
