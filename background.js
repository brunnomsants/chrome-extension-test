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

    // --- SMART PARSING: Extraction for YouTube and JSON ---
    if (req.postData) {
      try {
        const jsonObj = JSON.parse(req.postData);
        
        // Check if this is a YouTube search request
        if (jsonObj.query) {
          displayTitle = `🔍 SEARCH: "${jsonObj.query}"`;
        } else if (req.url.includes('youtubei/v1/')) {
          const endpoint = req.url.split('v1/')[1].split('?')[0];
          displayTitle = `📺 YT API: ${endpoint}`;
        }

        // Optional: Re-format JSON for the cURL to be slightly more readable
        finalPostData = JSON.stringify(jsonObj);
      } catch (e) {
        // Not JSON, keep original postData
      }
    }

    // --- CLEAN CURL CONSTRUCTION ---
    let curl = `curl '${req.url}' \\\n  -X ${req.method}`;
    
    if (req.headers) {
      for (const [key, val] of Object.entries(req.headers)) {
        if (ESSENTIAL_HEADERS.includes(key.toLowerCase())) {
          curl += ` \\\n  -H '${key}: ${val}'`;
        }
      }
    }

    if (finalPostData) {
      // Escape single quotes to prevent breaking the shell command
      const escapedData = finalPostData.replace(/'/g, "\\'");
      curl += ` \\\n  --data-raw '${escapedData}'`;
    }

    const newReq = { 
      id: params.requestId, 
      url: displayTitle, // This goes to the popup list
      method: req.method, 
      curl: curl 
    };

    chrome.storage.local.get({ requests: [] }, (data) => {
      chrome.storage.local.set({ requests: [newReq, ...data.requests].slice(0, 50) });
    });
  }
});
