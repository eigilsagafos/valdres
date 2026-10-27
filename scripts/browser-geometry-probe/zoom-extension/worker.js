// Called by the probe driver over the DevTools protocol.
self.zoomProbeTab = async factor => {
    const [tab] = await chrome.tabs.query({ url: "http://127.0.0.1/*" })
    await chrome.tabs.setZoom(tab.id, factor)
}
