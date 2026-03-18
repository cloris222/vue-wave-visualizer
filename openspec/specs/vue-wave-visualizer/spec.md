# vue-wave-visualizer Specification

## Purpose

提供一個 Vue 3 元件，能夠將 `MediaStream`（例如麥克風輸入）透過 Web Audio API 與 Canvas API 即時渲染為音波視覺化圖形，並支援多種視覺模式、靜音偵測與串流生命週期事件。

---

## Requirements

### Requirement: 串流初始化

元件 SHALL 在接收到非 null 的 `stream` prop 時，建立 AudioContext 與 AnalyserNode，並啟動 requestAnimationFrame 渲染迴圈。

#### Scenario: 傳入有效串流

- WHEN 元件掛載時 `stream` prop 為有效的 `MediaStream`
- THEN 元件建立 `AudioContext` 並連接 `AnalyserNode`
- AND 啟動 rAF 渲染迴圈，開始繪製音波

#### Scenario: 傳入 null 串流

- WHEN 元件掛載時 `stream` prop 為 `null`
- THEN 元件不建立 AudioContext
- AND 在 Canvas 上渲染靜止的 calm state

#### Scenario: 串流切換

- WHEN `stream` prop 從某個串流變更為另一個串流
- THEN 元件斷開舊的 `MediaStreamSourceNode`
- AND 重新連接新串流的 `MediaStreamSourceNode`
- AND 繼續使用原有的 `AudioContext` 與 `AnalyserNode`（不重建）

#### Scenario: 串流切換為 null

- WHEN `stream` prop 變更為 `null`
- THEN 元件停止 rAF 迴圈
- AND 在 Canvas 上渲染靜止的 calm state

#### Scenario: 傳入已結束的串流

- WHEN `stream` 的 audio track `readyState` 為 `'ended'`
- THEN 元件 SHALL NOT 啟動 rAF 迴圈
- AND 觸發 `stream-end` 事件

---

### Requirement: 視覺化模式

元件 SHALL 根據 `mode` prop 選擇對應的渲染函式，以正確的方式繪製音訊資料。

#### Scenario: waveform 模式

- WHEN `mode` 為 `'waveform'`
- THEN 元件使用 `getByteTimeDomainData` 讀取時域資料
- AND 繪製連續折線，Y 軸映射公式為 `y = (data[i] / 128.0 * height) / 2`

#### Scenario: bars 模式

- WHEN `mode` 為 `'bars'`
- THEN 元件使用 `getByteFrequencyData` 讀取頻域資料
- AND 繪製 `Math.min(barCount, frequencyBinCount)` 根垂直長條
- AND 每根長條最小高度為 1px

#### Scenario: mirror-bars 模式

- WHEN `mode` 為 `'mirror-bars'`
- THEN 元件使用 `getByteFrequencyData` 讀取頻域資料
- AND 繪製以 Canvas 垂直中心為軸、上下對稱的鏡像長條

#### Scenario: circular 模式

- WHEN `mode` 為 `'circular'`
- THEN 元件使用 `getByteFrequencyData` 讀取頻域資料
- AND 繪製從基圓向外延伸的放射狀尖刺，數量為 `barCount`
- AND 基圓半徑為 `min(cx, cy) × 0.35`，最大尖刺長度為 `min(cx, cy) × 0.55`

#### Scenario: calm state（閒置畫面）

- WHEN 串流為 `null` 或串流結束
- THEN 在 `waveform` 模式下繪製水平中線（所有值為 128）
- THEN 在其他模式下繪製高度為零的長條

---

### Requirement: 靜音偵測

元件 SHALL 在每個渲染幀計算時域資料的 RMS 振幅，偵測是否持續靜音。

#### Scenario: 持續靜音超過閾值時間

- WHEN RMS 振幅低於 `silenceThreshold`
- AND 此狀態持續超過 `silenceDuration` 毫秒
- THEN 觸發一次 `silence` 事件，payload 為 `{ duration: number }`
- AND 後續靜音期間不重複觸發，直到音訊恢復

#### Scenario: 靜音後音訊恢復

- WHEN 曾觸發過 `silence` 事件後 RMS 振幅回升至 `silenceThreshold` 以上
- THEN 觸發 `audio-active` 事件
- AND 重置靜音計時

#### Scenario: waveform 模式的效能優化

- WHEN `mode` 為 `'waveform'`
- THEN 元件 SHALL 重用已讀取的時域資料作為 RMS 計算來源
- AND SHALL NOT 對同一幀呼叫兩次 `getByteTimeDomainData`

---

### Requirement: 串流生命週期事件

元件 SHALL 監聽 MediaStreamTrack 的 `ended` 事件，並適當地通知外部。

#### Scenario: 音訊軌道結束

- WHEN MediaStreamTrack 觸發 `ended` 事件（如麥克風被拔除或權限被撤銷）
- THEN 元件停止 rAF 迴圈
- AND 渲染 calm state
- AND 觸發 `stream-end` 事件

#### Scenario: 串流無音訊軌道

- WHEN `stream.getAudioTracks()` 回傳空陣列
- THEN 立即觸發 `stream-end` 事件

---

### Requirement: Props 驗證

元件 SHALL 在使用 props 前進行驗證，無效值回退至預設值，不應拋出例外。

#### Scenario: height 無效

- WHEN `height` ≤ 0
- THEN 使用預設值 `120`

#### Scenario: fftSize 無效

- WHEN `fftSize` 不是 2 的冪次，或超出範圍 `[32, 32768]`
- THEN 使用預設值 `2048`

#### Scenario: smoothingTimeConstant 超出範圍

- WHEN `smoothingTimeConstant` 不在 `[0, 1]` 範圍內
- THEN 使用預設值 `0.8`

#### Scenario: mode 無效

- WHEN `mode` 不屬於 `'waveform' | 'bars' | 'circular' | 'mirror-bars'`
- THEN 使用預設值 `'waveform'`

---

### Requirement: Canvas 尺寸管理

元件 SHALL 正確管理 Canvas 的實體像素與 CSS 像素，並響應容器尺寸變化。

#### Scenario: 裝置像素比縮放

- WHEN Canvas 初始化或尺寸更新
- THEN Canvas 的 `width` / `height` attribute 乘以 `window.devicePixelRatio`
- AND CSS `width` / `height` 保持原始 CSS 像素值，避免模糊

#### Scenario: 容器寬度變化

- WHEN ResizeObserver 偵測到父元素寬度改變
- THEN 停止當前 rAF 迴圈
- AND 更新 Canvas 尺寸
- AND 若串流仍存在，重新啟動 rAF 迴圈

#### Scenario: height prop 變更

- WHEN `height` prop 在執行期間改變
- THEN 更新 Canvas 高度（含 DPR 縮放）
- AND 重新渲染 calm state 或繼續渲染動態內容

---

### Requirement: 錯誤處理

元件 SHALL 在瀏覽器不支援 Web Audio API 或 AudioContext 建立失敗時，通知外部而不拋出未捕獲的例外。

#### Scenario: 瀏覽器不支援 Web Audio API

- WHEN `window.AudioContext` 與 `window.webkitAudioContext` 均不存在
- THEN 觸發 `error` 事件，payload 為 `{ code: 'UNSUPPORTED', message: 'Web Audio API not supported.' }`

#### Scenario: AudioContext 建立失敗

- WHEN `new AudioContext()` 拋出例外
- THEN 觸發 `error` 事件，payload 為 `{ code: 'AUDIO_CONTEXT_FAILED', message: <錯誤訊息> }`

---

### Requirement: 元件卸載清理

元件 SHALL 在卸載時釋放所有 Web Audio 資源，避免記憶體洩漏。

#### Scenario: 元件卸載

- WHEN 元件觸發 `onUnmounted`
- THEN 取消當前 rAF 迴圈
- AND 斷開 `ResizeObserver`
- AND 斷開 `MediaStreamSourceNode` 與 `AnalyserNode`
- AND 關閉 `AudioContext`（呼叫 `ctx.close()`）
