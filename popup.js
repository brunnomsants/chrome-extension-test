const list = document.getElementById('requestList');
const toggleBtn = document.getElementById('toggleBtn');
const clearBtn = document.getElementById('clearBtn');

function renderRequests() {
  chrome.storage.local.get(['requests', 'isIntercepting'], (data) => {
    toggleBtn.innerText = data.isIntercepting ? "Stop Intercept" : "Start Intercept";
    toggleBtn.style.background = data.isIntercepting ? "#ffc107" : "#007bff";
    list.innerHTML = '';
    
    if (!data.requests || data.requests.length === 0) {
      list.innerHTML = '<p style="text-align:center; color:#999;">No pending requests.</p>';
      return;
    }

    data.requests.forEach(req => {
      const div = document.createElement('div');
      div.className = 'request-card';
      div.innerHTML = `
        <span class="url"><span class="method">${req.method}</span>${req.url}</span>
        <div class="actions">
          <button class="forward-btn" data-id="${req.id}">Forward</button>
          <button class="copy-btn" data-curl="${encodeURIComponent(req.curl)}">Copy cURL</button>
        </div>
      `;
      list.appendChild(div);
    });
  });
}

toggleBtn.onclick = () => {
  chrome.storage.local.get('isIntercepting', (data) => {
    const newState = !data.isIntercepting;
    chrome.runtime.sendMessage({ type: "TOGGLE", status: newState });
    chrome.storage.local.set({ isIntercepting: newState }, renderRequests);
  });
};

clearBtn.onclick = () => {
  chrome.storage.local.set({ requests: [] }, renderRequests);
};

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('forward-btn')) {
    chrome.runtime.sendMessage({ type: "FORWARD", id: e.target.dataset.id });
    e.target.closest('.request-card').style.opacity = '0.4'; // Visual feedback
  }
  if (e.target.classList.contains('copy-btn')) {
    const curlCommand = decodeURIComponent(e.target.dataset.curl);
    navigator.clipboard.writeText(curlCommand);
    const originalText = e.target.innerText;
    e.target.innerText = "Copied!";
    setTimeout(() => e.target.innerText = originalText, 1000);
  }
});

// Refresh UI when storage changes
chrome.storage.onChanged.addListener(renderRequests);
renderRequests();
