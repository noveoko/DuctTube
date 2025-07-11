// This script runs in the background and listens for when you navigate to a YouTube page.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Check if the tab's URL is a YouTube page and the page has finished loading.
  if (tab.url && tab.url.includes("youtube.com") && changeInfo.status === 'complete') {
    // If it is, inject the content script into the page.
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    });
  }
});
