let currentTabId = null;
const ESSENTIAL_HEADERS = ['content-type', 'authorization', 'x-goog-authuser', 'origin'];

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "TOGGLE") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      const target = { tabId: tabs[0].id };
      currentTabId = tabs[0].id;
      if (msg.status) {
        chrome.debugger.attach(target, "1.3", () => {
          chrome.debugger.sendCommand(target, "Fetch.enable", {
            patterns: [{ urlPattern: '*', requestStage: 'Request' }]
          });
        });
      } else {
        chrome.debugger.detach(target).catch(() => {});
      }
    });
  }
  if (msg.type === "FORWARD") {
    if (currentTabId) {
      chrome.debugger.sendCommand({ tabId: currentTabId }, "Fetch.continueRequest", { requestId: msg.id }).catch(() => {});
      chrome.storage.local.get('requests', (data) => {
        const filtered = (data.requests || []).filter(r => r.id !== msg.id);
        chrome.storage.local.set({ requests: filtered });
      });
    }
  }
});

chrome.debugger.onEvent.addListener((source, method, params) => {
  if (method === "Fetch.requestPaused") {
    const req = params.request;
    let displayTitle = req.url;
    let finalPostData = req.postData || "";

    if (req.postData) {
      try {
        const jsonObj = JSON.parse(req.postData);
        finalPostData = JSON.stringify(jsonObj);
      } catch (e) {

      }
    }


    let curl = `curl "${req.url}" ^\n  -X ${req.method}`;

    if (req.headers) {
      for (const [key, val] of Object.entries(req.headers)) {
        if (ESSENTIAL_HEADERS.includes(key.toLowerCase())) {
          const escapedVal = val.replace(/"/g, '\\"');
          curl += ` ^\n  -H "${key}: ${escapedVal}"`;
        }
      }
    }

    if (finalPostData) {

      const escapedData = finalPostData.replace(/"/g, '\\"');
      curl += ` ^\n  --data-raw "${escapedData}"`;
    }

    const newReq = {
      id: params.requestId,
      url: displayTitle,
      method: req.method,
      curl: curl
    };

    chrome.storage.local.get({ requests: [] }, (data) => {
      chrome.storage.local.set({ requests: [newReq, ...data.requests].slice(0, 50) });
    });
  }
});