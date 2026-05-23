# Voice TTS

训练播报支持本地 Web Speech 与 Legado 兼容在线 TTS。默认不导入在线引擎时，行为与原本的本地朗读一致。

## Legado JSON 兼容范围

支持单对象或数组配置，字段包括 `name`、`url`、`header`、`contentType`。`header` 可以是 JSON 字符串或对象。当前只替换这些占位符：

- `{{speakText}}`
- `{{java.encodeURI(speakText)}}`
- 任意包含 `speakText` 的 `{{...}}` 表达式，统一替换为 `encodeURIComponent(text)`
- `{{speakSpeed}}`
- `{{speakPitch}}`

不实现 Legado 的完整 JavaScript 表达式引擎，也不执行 `{{java.xxx(...)}}`。如果站点是 HTTPS，在线 TTS URL 也必须是 HTTPS；TTS 反代还需要返回允许当前站点访问的 CORS 响应头。

## 手动验收

1. 在“我的 > AI/同步设置”里的“语音引擎”导入一条可达的 Legado URL，优先级设为 `online-first`，点击测试朗读，训练播报应使用在线音色。
2. 切飞行模式或断网后开始训练，在线请求失败时应自动回退本地朗读，训练计时不能卡住。
3. 同时播放页面内音频或视频，训练播报期间该媒体音量会降到 0.15，播报结束后恢复。
4. 暂停训练时，当前播报应立即停止；恢复后由下一句训练播报自然触发。
5. 跳过当前阶段时，当前播报应立即停止，下一句应正常播报。
6. 启用缓存并完成一次在线播报后，断网再测试同一文本、语速、音调，命中缓存时仍能播放在线音色。

## 同步说明

`voice.engines` 可能包含请求头里的 Authorization 或 Cookie，因此默认只保存在本机，不写入远端同步快照。导出按钮会导出当前设备上的在线引擎配置，请自行保管导出的 JSON。
