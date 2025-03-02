chrome.runtime.onInstalled.addListener(function() {
    // Initialize default configuration
    chrome.storage.sync.get('youtubeFocusConfig', function(data) {
      if (!data.youtubeFocusConfig) {
        const defaultConfig = {
          replaceThumbnails: true,
          deClickbaitTitles: true,
          hideShorts: false,
          hideRecommendations: false,
          hideTrending: true,
          hideComments: false,
          hideAds: true,
          keywordBlocking: true,
          blockedKeywords: ["clickbait", "you won't believe"],
          enableFocusMode: true,
          maxWatchTime: 60, // minutes
          notifyWatchTime: true
        };
        
        chrome.storage.sync.set({ 'youtubeFocusConfig': defaultConfig });
      }
    });
  });
  
  // Listen for tab changes to reset watch timer on leaving YouTube
  chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.url && changeInfo.url.includes('youtube.com')) {
      // Only send message if we're on YouTube
      chrome.tabs.sendMessage(tabId, { action: 'configUpdated' }).catch(() => {
        // Ignore errors when content script isn't ready yet
      });
    }
  });