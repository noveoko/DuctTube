(function() {
  // Enable debug mode
  const DEBUG = true;

  // Add this debug logging function
  function debugLog(message, data) {
    if (DEBUG) {
      console.log(
        `%c[YouTubeFocus]%c ${message}`,
        'color: #ff0000; font-weight: bold;',
        'color: black;',
        data || ''
      );
    }
  }
  
  // Log startup immediately - helps diagnose if the script is running
  debugLog('YouTubeFocus script loaded and starting...');

  // Define the categories and their colors
  const VIDEO_CATEGORIES = {
    "Education & How-To": "#3498db",  // Blue
    "Entertainment & Comedy": "#e74c3c",  // Red
    "Vlogging & Lifestyle": "#9b59b6",  // Purple
    "Tech & Reviews": "#2ecc71",  // Green
    "Gaming": "#f39c12",  // Orange
    "Fitness & Health": "#1abc9c",  // Teal
    "Finance & Business": "#f1c40f",  // Yellow
    "News & Commentary": "#34495e",  // Dark Blue
    "Food & Cooking": "#27ae60",  // Dark Green
    "Art & Creativity": "#e67e22",  // Dark Orange
  };

  // Configuration (will be loaded from storage)
  let config = {
    replaceThumbnails: true,
    deClickbaitTitles: true,
    hideShorts: true, // Set to true by default to hide shorts
    hideRecommendations: false,
    hideTrending: true,
    hideComments: false,
    hideAds: true,
    keywordBlocking: true,
    blockedKeywords: ["clickbait", "you won't believe"],
    enableFocusMode: true,
    maxWatchTime: 60, // minutes
    notifyWatchTime: true,
    blackAndWhitePreviews: true, // New setting for B&W previews
    useOllama: true,  // Change to true by default to make sure it's enabled
    ollamaEndpoint: "http://localhost:8000",
    ollamaModel: "llama3:8b",
    enableCategoryFiltering: true,
    visibleCategories: Object.keys(VIDEO_CATEGORIES), // All categories visible by default
    categorizedVideos: {}, // Store video ID -> category mappings
  };
  
  // Variables to track watch time
  let watchStartTime = null;
  let totalWatchTime = 0;
  let watchTimeInterval = null;
  let isWatching = false;
  
  // Track when video hover events happen
  let hoverTimeouts = new Map();
  
  // Debounce function to prevent excessive processing
  function debounce(func, wait) {
    let timeout;
    return function() {
      const context = this;
      const args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  }

  // Apply immediate functionality - run before waiting for configuration
  function immediateInit() {
    debugLog('Running immediate initialization...');
    
    // Apply basic styles first - these don't depend on config
    addShortsBlockingStyles();
    addBlackAndWhitePreviewsStyle();
    
    // Hide YouTube Shorts selectively
    let shortsSections = document.querySelectorAll("ytd-rich-section-renderer");
    shortsSections.forEach(section => {
      // Only hide if it contains shorts content
      if (section.querySelector('ytd-shorts, ytd-shorts-video-renderer, a[href^="/shorts/"]')) {
        section.style.display = "none";
      } else if (section.querySelector('#title, span')) {
        const title = section.querySelector('#title, span');
        if (title && title.textContent === 'Shorts') {
          section.style.display = 'none';
        }
      }
    });
    
    // Process thumbnails and titles immediately
    setTimeout(() => {
      hideAllShorts();
      processThumbnails();
      processTitles();
      
      const ads = document.querySelectorAll('ytd-promoted-video-renderer');
      ads.forEach(ad => {
        ad.style.display = 'none';
      });
    }, 100);
  }
  
  // Load configuration
  function loadConfig() {
    debugLog('Loading configuration...');
    chrome.storage.sync.get('youtubeFocusConfig', function(data) {
      if (data.youtubeFocusConfig) {
        config = { ...config, ...data.youtubeFocusConfig };
      }
      debugLog("Config loaded", config);
      
      // Apply features based on loaded configuration
      if (config.hideShorts) {
        addShortsBlockingStyles();
        hideAllShorts();
        setupExtraShortsObserver();
      }
      
      if (config.blackAndWhitePreviews) {
        addBlackAndWhitePreviewsStyle();
        applyBlackAndWhiteToVideoPreviews();
      }
      
      // Continue with full initialization
      initializePlugin();
    });
  }
  
  // Setup extra observer for title changes
  function setupExtraObserver() {
    // Set up a MutationObserver to detect YouTube's pushState navigation
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Look for newly added video title elements
          for (let i = 0; i < mutation.addedNodes.length; i++) {
            const node = mutation.addedNodes[i];
            if (node.nodeType === 1) { // Element node
              const titles = node.querySelectorAll('#video-title, ytd-watch-metadata h1');
              if (titles.length > 0) {
                debugLog('Found newly added titles, processing...');
                setTimeout(() => {
                  processTitles();
                }, 100);
                break;
              }
            }
          }
        }
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('yt-navigate-finish', function() {
      debugLog('YouTube navigation detected, processing titles...');
      setTimeout(() => {
        processTitles();
      }, 300); // Delay to ensure the page is fully rendered
    });
  }
  
  // Setup additional observer for shorts from user's code
  function setupExtraShortsObserver() {
    // Check if we already have this observer
    if (window.extraShortsObserver) {
      window.extraShortsObserver.disconnect();
    }
    
    // Create new observer
    window.extraShortsObserver = new MutationObserver(() => {
      // Only hide rich-section-renderers that contain shorts content
      let shortsSections = document.querySelectorAll("ytd-rich-section-renderer");
      shortsSections.forEach(section => {
        // Only hide if it contains shorts content
        if (section.querySelector('ytd-shorts, ytd-shorts-video-renderer, a[href^="/shorts/"]')) {
          section.style.display = "none";
          debugLog('Extra observer hiding shorts section', section);
        } else if (section.querySelector('#title, span')) {
          const title = section.querySelector('#title, span');
          if (title && title.textContent === 'Shorts') {
            section.style.display = 'none';
          }
        }
      });
    });
    
    // Start observing
    window.extraShortsObserver.observe(document.body, { childList: true, subtree: true });
    debugLog('Extra shorts observer started');
  }
  
  // Check if Ollama title processing is enabled and configured
  function useOllamaForTitles() {
    const isEnabled = config.useOllama && config.ollamaEndpoint && config.ollamaModel;
    debugLog(`Ollama enabled: ${isEnabled}`, {
      useOllama: config.useOllama,
      endpoint: config.ollamaEndpoint,
      model: config.ollamaModel
    });
    return isEnabled;
  }
  
  // Process a single title with Ollama
  async function processOllamaTitle(title) {
    debugLog('Processing title with Ollama:', title);
    
    if (!useOllamaForTitles() || !title) {
      debugLog('Ollama not configured or empty title, skipping');
      return title;
    }
    
    try {
      debugLog(`Sending request to ${config.ollamaEndpoint}/fix-title`);
      
      const response = await fetch(`${config.ollamaEndpoint}/fix-title`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title,
          model: config.ollamaModel
        }),
      });
      
      if (!response.ok) {
        debugLog(`Error from Ollama backend: ${response.status}`);
        return title;
      }
      
      const data = await response.json();
      debugLog('Received response from Ollama:', data);
      
      // Mark the title so we can see it's been processed by Ollama
      return `${data.factual}`;
    } catch (error) {
      debugLog('Error calling Ollama backend:', error);
      return title;
    }
  }
  
  // Update the deClickbaitTitle function to use Ollama when configured
  async function deClickbaitTitleWithOllama(title) {
    // First try getting a better title from Ollama
    if (useOllamaForTitles()) {
      try {
        debugLog(`Trying Ollama for title: ${title}`);
        const ollamaTitle = await processOllamaTitle(title);
        if (ollamaTitle && ollamaTitle !== title) {
          debugLog(`Ollama transformed title to: ${ollamaTitle}`);
          return ollamaTitle;
        }
      } catch (error) {
        debugLog('Error with Ollama title processing:', error);
        // Fall back to local processing if Ollama fails
      }
    }
    
    // Fall back to the original deClickbaitTitle function
    debugLog(`Using fallback for title: ${title}`);
    return deClickbaitTitle(title);
  }
  
  // Make sure the processTitlesAsync function properly updates the titles
  async function processTitlesAsync() {
    debugLog("Starting async title processing");
    
    const titles = document.querySelectorAll(`
      #video-title:not(.ytd-focus-processed), 
      yt-formatted-string.ytd-rich-grid-media:not(.ytd-focus-processed),
      .ytd-compact-video-renderer #video-title:not(.ytd-focus-processed),
      .ytd-grid-video-renderer #video-title:not(.ytd-focus-processed),
      .ytd-rich-item-renderer #video-title:not(.ytd-focus-processed),
      .ytd-video-renderer #video-title:not(.ytd-focus-processed),
      .ytd-compact-video-renderer #metadata-line:not(.ytd-focus-processed),
      a.yt-simple-endpoint h3:not(.ytd-focus-processed),
      ytd-playlist-panel-video-renderer #video-title:not(.ytd-focus-processed),
      ytd-watch-metadata h1:not(.ytd-focus-processed)
    `);
    
    debugLog(`Found ${titles.length} unprocessed titles`);
    
    for (const title of titles) {
      // Skip if null or empty
      if (!title || !title.textContent.trim()) continue;
      
      // Mark as processed
      title.classList.add('ytd-focus-processed');
      
      // Store original text for toggling
      if (!title.dataset.originalText) {
        title.dataset.originalText = title.textContent;
      }
      
      // Process the title
      if (config.deClickbaitTitles) {
        try {
          debugLog(`Processing title: ${title.dataset.originalText}`);
          const newTitle = await deClickbaitTitleWithOllama(title.dataset.originalText);
          debugLog(`Title transformed: ${title.dataset.originalText} -> ${newTitle}`);
          
          // Directly update the title text
          title.textContent = newTitle;
        } catch (error) {
          debugLog(`Error processing title: ${error.message}`);
          // Fallback to regular de-clickbaiting
          title.textContent = deClickbaitTitle(title.dataset.originalText);
        }
      }
      
      // Check for blocked keywords
      if (config.keywordBlocking) {
        if (shouldBlockContent(title.dataset.originalText)) {
          const videoContainer = title.closest(`
            ytd-grid-video-renderer, ytd-rich-item-renderer, 
            ytd-video-renderer, ytd-compact-video-renderer,
            ytd-reel-item-renderer, ytd-playlist-renderer,
            ytd-compact-playlist-renderer
          `);
          if (videoContainer) {
            videoContainer.style.display = 'none';
          }
        }
      }
    }
    
    debugLog('Finished async title processing');
  }
  
  // Process titles function (entry point for title processing)
  function processTitles() {
    // If Ollama is enabled, use the async version
    if (useOllamaForTitles()) {
      debugLog('Using Ollama for title processing');
      // Need to explicitly call the async function since we're in a synchronous context
      setTimeout(() => {
        processTitlesAsync().catch(err => {
          debugLog('Error in async title processing:', err);
        });
      }, 0);
      return;
    }
    
    // Otherwise use the original synchronous version
    debugLog('Using standard title processing (Ollama disabled)');
    
    const titles = document.querySelectorAll(`
      #video-title:not(.ytd-focus-processed), 
      yt-formatted-string.ytd-rich-grid-media:not(.ytd-focus-processed),
      .ytd-compact-video-renderer #video-title:not(.ytd-focus-processed),
      .ytd-grid-video-renderer #video-title:not(.ytd-focus-processed),
      .ytd-rich-item-renderer #video-title:not(.ytd-focus-processed),
      .ytd-video-renderer #video-title:not(.ytd-focus-processed),
      .ytd-compact-video-renderer #metadata-line:not(.ytd-focus-processed),
      a.yt-simple-endpoint h3:not(.ytd-focus-processed),
      ytd-playlist-panel-video-renderer #video-title:not(.ytd-focus-processed),
      ytd-watch-metadata h1:not(.ytd-focus-processed)
    `);
    
    titles.forEach(title => {
      // Skip if null or empty (sometimes happens with dynamic content)
      if (!title || !title.textContent.trim()) return;
      
      // Mark as processed
      title.classList.add('ytd-focus-processed');
      
      // Store original text for toggling
      if (!title.dataset.originalText) {
        title.dataset.originalText = title.textContent;
      }
      
      // Process the title
      if (config.deClickbaitTitles) {
        title.textContent = deClickbaitTitle(title.dataset.originalText);
      }
      
      // Check for blocked keywords
      if (config.keywordBlocking) {
        if (shouldBlockContent(title.dataset.originalText)) {
          // Find the container with an expanded selector
          const videoContainer = title.closest(`
            ytd-grid-video-renderer, ytd-rich-item-renderer, 
            ytd-video-renderer, ytd-compact-video-renderer,
            ytd-reel-item-renderer, ytd-playlist-renderer,
            ytd-compact-playlist-renderer
          `);
          if (videoContainer) {
            videoContainer.style.display = 'none';
          }
        }
      }
    });
  }
  
  // Load categorized videos from storage
  function loadCategorizedVideos() {
    chrome.storage.local.get('youtubeFocusCategories', function(data) {
      if (data.youtubeFocusCategories) {
        config.categorizedVideos = data.youtubeFocusCategories;
        debugLog(`Loaded ${Object.keys(config.categorizedVideos).length} categorized videos from storage`);
      }
    });
  }
  
  // Classify a video title using the backend
  async function classifyVideoTitle(title, videoId) {
    if (!useOllamaForTitles() || !title) {
      return null;
    }
    
    // Check if we've already classified this video
    if (config.categorizedVideos[videoId]) {
      debugLog(`Using cached category for video ${videoId}`);
      return config.categorizedVideos[videoId];
    }
    
    try {
      debugLog(`Classifying video title: ${title}`);
      
      const response = await fetch(`${config.ollamaEndpoint}/classify-title`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title,
          model: config.ollamaModel
        }),
      });
      
      if (!response.ok) {
        debugLog(`Error from classification endpoint: ${response.status}`);
        return null;
      }
      
      const data = await response.json();
      debugLog(`Classification result:`, data);
      
      // Store the category in our cache
      if (videoId) {
        config.categorizedVideos[videoId] = data;
        
        // Save to Chrome storage periodically
        saveCategoriesToStorage();
      }
      
      return data;
    } catch (error) {
      debugLog('Error classifying title:', error);
      return null;
    }
  }
  
  // Throttled save to prevent excessive storage writes
  let saveTimeout = null;
  function saveCategoriesToStorage() {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    saveTimeout = setTimeout(() => {
      chrome.storage.local.set({
        'youtubeFocusCategories': config.categorizedVideos
      }, () => {
        debugLog('Saved categories to storage');
      });
    }, 5000); // Save after 5 seconds of inactivity
  }
  
  // Apply category styling to a video container
  function applyCategoryStyling(videoContainer, category, color) {
    if (!videoContainer || !category || !color) return;
    
    // Create a border based on the category
    videoContainer.style.border = `3px solid ${color}`;
    videoContainer.style.borderRadius = '4px';
    videoContainer.style.position = 'relative';
    
    // Add a category label if it doesn't exist
    if (!videoContainer.querySelector('.ytd-focus-category-label')) {
      const label = document.createElement('div');
      label.className = 'ytd-focus-category-label';
      label.textContent = category.split('–')[0].trim(); // Just the main category name, not the description
      label.style.position = 'absolute';
      label.style.top = '0';
      label.style.right = '0';
      label.style.backgroundColor = color;
      label.style.color = '#fff';
      label.style.padding = '2px 5px';
      label.style.fontSize = '10px';
      label.style.borderRadius = '0 0 0 4px';
      label.style.zIndex = '1000';
      
      videoContainer.appendChild(label);
    }
    
    // Store category in data attribute for filtering
    videoContainer.dataset.category = category;
  }
  
  // Process a video's category
  async function processVideoCategory(thumbnail) {
    // Find the video container
    const videoContainer = thumbnail.closest(`
      ytd-grid-video-renderer, 
      ytd-rich-item-renderer, 
      ytd-video-renderer, 
      ytd-compact-video-renderer,
      ytd-reel-item-renderer
    `);
    
    if (!videoContainer) return;
    
    // Find the video title and ID
    const titleElement = videoContainer.querySelector('#video-title, .title');
    if (!titleElement || !titleElement.textContent.trim()) return;
    
    const title = titleElement.textContent.trim();
    
    // Try to get the video ID from various possible sources
    let videoId = null;
    const link = videoContainer.querySelector('a[href*="watch?v="]');
    if (link) {
      const match = link.href.match(/watch\?v=([^&]+)/);
      if (match) {
        videoId = match[1];
      }
    }
    
    // If we couldn't find an ID, use the title as a key
    const videoKey = videoId || title;
    
    // Check if we need to classify the video
    if (config.enableCategoryFiltering) {
      const categoryData = await classifyVideoTitle(title, videoKey);
      
      if (categoryData) {
        applyCategoryStyling(videoContainer, categoryData.category, categoryData.color);
        
        // Hide the video if its category is not in the visible categories list
        if (!config.visibleCategories.includes(categoryData.category)) {
          videoContainer.style.display = 'none';
        }
      }
    }
  }
  
  // Check for videos needing categorization and apply
  async function applyCategoriesToVisibleVideos() {
    if (!config.enableCategoryFiltering) return;
    
    // Get all video containers that don't have categories yet
    const videoContainers = document.querySelectorAll(`
      ytd-grid-video-renderer:not([data-category]), 
      ytd-rich-item-renderer:not([data-category]), 
      ytd-video-renderer:not([data-category]), 
      ytd-compact-video-renderer:not([data-category]),
      ytd-reel-item-renderer:not([data-category])
    `);
    
    debugLog(`Found ${videoContainers.length} uncategorized video containers`);
    
    // Process each container
    for (const container of videoContainers) {
      const thumbnail = container.querySelector('ytd-thumbnail, img');
      if (thumbnail) {
        await processVideoCategory(thumbnail);
      }
    }
    
    // Also check for any containers that have categories but might need to be hidden
    filterVideosByCategory();
  }
  
  // Filter videos based on visible categories
  function filterVideosByCategory() {
    if (!config.enableCategoryFiltering) return;
    
    // Get all categorized video containers
    const videoContainers = document.querySelectorAll('[data-category]');
    
    debugLog(`Filtering ${videoContainers.length} categorized videos`);
    
    videoContainers.forEach(container => {
      const category = container.dataset.category;
      
      // Show or hide based on category visibility
      if (config.visibleCategories.includes(category)) {
        container.style.display = '';
      } else {
        container.style.display = 'none';
      }
    });
  }
  
  // Save visible categories to storage
  function saveVisibleCategories() {
    chrome.storage.sync.set({
      'youtubeFocusVisibleCategories': config.visibleCategories
    }, () => {
      debugLog('Saved visible categories to storage');
    });
  }
  
  // Load visible categories from storage
  function loadVisibleCategories() {
    chrome.storage.sync.get('youtubeFocusVisibleCategories', function(data) {
      if (data.youtubeFocusVisibleCategories) {
        config.visibleCategories = data.youtubeFocusVisibleCategories;
        debugLog(`Loaded visible categories from storage:`, config.visibleCategories);
        
        // Update UI if it exists
        document.querySelectorAll('.ytd-focus-category-filter .category input').forEach(checkbox => {
          const category = checkbox.parentElement.textContent.trim();
          checkbox.checked = config.visibleCategories.some(cat => cat.startsWith(category));
        });
        
        // Apply filtering
        filterVideosByCategory();
      }
    });
  }
  
  // Initialize content categories
  function initializeContentCategories() {
    // Load previously categorized videos
    loadCategorizedVideos();
    
    // Add the category filter styles
    addCategoryFilterStyles();
    
    // Initial categorization
    setTimeout(() => {
      applyCategoriesToVisibleVideos();
    }, 1500);
  }
  
  // Add CSS for category filtering UI and shorts toggle
  function addCategoryFilterStyles() {
    if (document.getElementById('ytd-focus-category-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'ytd-focus-category-styles';
    style.textContent = `
      .ytd-focus-category-filter {
        position: fixed;
        top: 70px;
        right: 20px;
        background: white;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 10px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        z-index: 9999;
        max-width: 300px;
        transition: transform 0.3s ease;
        transform: translateX(calc(100% - 40px));
      }
      
      .ytd-focus-category-filter:hover {
        transform: translateX(0);
      }
      
      .ytd-focus-category-filter h3 {
        margin: 0 0 8px 0;
        font-size: 14px;
        display: flex;
        justify-content: space-between;
      }
      
      .ytd-focus-category-filter .toggle-all {
        cursor: pointer;
        font-size: 12px;
        color: #3ea6ff;
      }
      
      .ytd-focus-category-filter .categories {
        display: flex;
        flex-direction: column;
        gap: 5px;
        max-height: 300px;
        overflow-y: auto;
      }
      
      .ytd-focus-category-filter .category {
        display: flex;
        align-items: center;
        font-size: 13px;
      }
      
      .ytd-focus-category-filter .category input {
        margin-right: 5px;
      }
      
      .ytd-focus-category-filter .category .color {
        width: 10px;
        height: 10px;
        display: inline-block;
        margin-right: 5px;
        border-radius: 50%;
      }
      
      /* Shorts toggle switch styles */
      .ytd-focus-shorts-toggle {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid #eee;
      }
      
      .ytd-focus-shorts-toggle h3 {
        margin: 0 0 8px 0;
        font-size: 14px;
      }
      
      .ytd-focus-switch {
        position: relative;
        display: inline-block;
        width: 48px;
        height: 24px;
      }
      
      .ytd-focus-switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }
      
      .ytd-focus-slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #ccc;
        transition: .3s;
        border-radius: 24px;
      }
      
      .ytd-focus-slider:before {
        position: absolute;
        content: "";
        height: 18px;
        width: 18px;
        left: 3px;
        bottom: 3px;
        background-color: white;
        transition: .3s;
        border-radius: 50%;
      }
      
      input:checked + .ytd-focus-slider {
        background-color: #ff0000;
      }
      
      input:focus + .ytd-focus-slider {
        box-shadow: 0 0 1px #ff0000;
      }
      
      input:checked + .ytd-focus-slider:before {
        transform: translateX(24px);
      }
      
      .ytd-focus-toggle-container {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      
      .ytd-focus-toggle-label {
        font-size: 13px;
      }
    `;
    
    document.head.appendChild(style);
  }
  
  // Create the category filter UI
  function createCategoryFilterUI() {
    // Check if we already created it
    if (document.querySelector('.ytd-focus-category-filter')) return;
    
    const filterContainer = document.createElement('div');
    filterContainer.className = 'ytd-focus-category-filter';
    
    // Create header with toggle all button
    const header = document.createElement('h3');
    header.textContent = 'Filter Categories';
    
    const toggleAll = document.createElement('span');
    toggleAll.className = 'toggle-all';
    toggleAll.textContent = 'Toggle All';
    toggleAll.addEventListener('click', () => {
      // If all are visible, hide all. Otherwise, show all.
      const allVisible = Object.keys(VIDEO_CATEGORIES).every(cat => 
        config.visibleCategories.includes(cat)
      );
      
      if (allVisible) {
        config.visibleCategories = [];
      } else {
        config.visibleCategories = [...Object.keys(VIDEO_CATEGORIES)];
      }
      
      // Update checkboxes
      document.querySelectorAll('.ytd-focus-category-filter .category input').forEach(checkbox => {
        checkbox.checked = !allVisible;
      });
      
      // Apply filtering
      filterVideosByCategory();
      
      // Save settings
      saveVisibleCategories();
    });
    
    header.appendChild(toggleAll);
    filterContainer.appendChild(header);
    
    // Create category list
    const categoriesList = document.createElement('div');
    categoriesList.className = 'categories';
    
    Object.entries(VIDEO_CATEGORIES).forEach(([category, color]) => {
      const categoryItem = document.createElement('label');
      categoryItem.className = 'category';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = config.visibleCategories.includes(category);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          // Add to visible categories if not already there
          if (!config.visibleCategories.includes(category)) {
            config.visibleCategories.push(category);
          }
        } else {
          // Remove from visible categories
          config.visibleCategories = config.visibleCategories.filter(cat => cat !== category);
        }
        
        // Apply filtering
        filterVideosByCategory();
        
        // Save settings
        saveVisibleCategories();
      });
      
      const colorSpan = document.createElement('span');
      colorSpan.className = 'color';
      colorSpan.style.backgroundColor = color;
      
      // Just show the main category name, not the full description
      const categoryName = document.createTextNode(category.split('–')[0].trim());
      
      categoryItem.appendChild(checkbox);
      categoryItem.appendChild(colorSpan);
      categoryItem.appendChild(categoryName);
      
      categoriesList.appendChild(categoryItem);
    });
    
    filterContainer.appendChild(categoriesList);
    
    // Add YouTube Shorts toggle below categories
    const shortsToggleSection = document.createElement('div');
    shortsToggleSection.className = 'ytd-focus-shorts-toggle';
    
    const shortsHeader = document.createElement('h3');
    shortsHeader.textContent = 'YouTube Shorts';
    shortsToggleSection.appendChild(shortsHeader);
    
    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'ytd-focus-toggle-container';
    
    const toggleLabel = document.createElement('span');
    toggleLabel.className = 'ytd-focus-toggle-label';
    toggleLabel.textContent = 'Hide Shorts';
    toggleContainer.appendChild(toggleLabel);
    
    const label = document.createElement('label');
    label.className = 'ytd-focus-switch';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = config.hideShorts;
    checkbox.addEventListener('change', () => {
      // Send message to toggle shorts
      chrome.runtime.sendMessage({ action: 'toggleShorts' });
      
      // Also toggle locally
      config.hideShorts = checkbox.checked;
      
      if (config.hideShorts) {
        addShortsBlockingStyles();
        hideAllShorts();
        debugLog('Shorts hidden via toggle');
        
        // Additional code from user to hide shorts sections
        let shortsSections = document.querySelectorAll("ytd-rich-section-renderer");
        shortsSections.forEach(section => section.style.display = "none");
        
        // Set up extra observer
        setupExtraShortsObserver();
      } else {
        const styleElement = document.getElementById('ytd-focus-shorts-style');
        if (styleElement) styleElement.remove();
        
        // Show shorts elements that were hidden
        document.querySelectorAll('ytd-rich-section-renderer[style*="display: none"]').forEach(el => {
          el.style.display = '';
        });
        
        // Also show other shorts elements
        const shortsSelectors = [
          'ytd-rich-shelf-renderer[is-shorts]',
          'ytd-reel-item-renderer',
          'ytd-guide-entry-renderer[title*="Shorts"]',
          'ytd-shorts-video-renderer',
          'ytd-shorts-carousel-renderer'
        ];
        
        document.querySelectorAll(shortsSelectors.join(', ')).forEach(el => {
          el.style.display = '';
        });
        
        debugLog('Shorts shown via toggle');
      }
      
      // Save to storage
      chrome.storage.sync.get('youtubeFocusConfig', function(data) {
        const updatedConfig = data.youtubeFocusConfig || {};
        updatedConfig.hideShorts = config.hideShorts;
        
        chrome.storage.sync.set({ 'youtubeFocusConfig': updatedConfig }, function() {
          debugLog('Saved shorts visibility setting:', config.hideShorts);
        });
      });
    });
    
    const slider = document.createElement('span');
    slider.className = 'ytd-focus-slider';
    
    label.appendChild(checkbox);
    label.appendChild(slider);
    toggleContainer.appendChild(label);
    
    shortsToggleSection.appendChild(toggleContainer);
    filterContainer.appendChild(shortsToggleSection);
    
    document.body.appendChild(filterContainer);
  }
  
  function initializePlugin() {
    debugLog('Initializing plugin fully...');
    
    // Initialize content categories
    initializeContentCategories();
    loadVisibleCategories();
    
    // Apply CSS to hide shorts from the initial page load
    if (config.hideShorts) {
      addShortsBlockingStyles();
      hideAllShorts();
      
      // Hide YouTube Shorts selectively
      let shortsSections = document.querySelectorAll("ytd-rich-section-renderer");
      shortsSections.forEach(section => {
        // Only hide if it contains shorts content
        if (section.querySelector('ytd-shorts, ytd-shorts-video-renderer, a[href^="/shorts/"]')) {
          section.style.display = "none";
        } else if (section.querySelector('#title, span')) {
          const title = section.querySelector('#title, span');
          if (title && title.textContent === 'Shorts') {
            section.style.display = 'none';
          }
        }
      });
      
      // Set up additional observer
      setupExtraShortsObserver();
    }
    
    // Apply modifications based on page type
    if (window.location.pathname === '/') {
      modifyHomePage();
    } else if (window.location.pathname.startsWith('/watch')) {
      modifyWatchPage();
    } else if (window.location.pathname.startsWith('/shorts')) {
      modifyShortsPage();
    } else if (window.location.pathname.startsWith('/results')) {
      modifySearchResults();
    }
    
    // Apply CSS for black and white previews
    if (config.blackAndWhitePreviews) {
      addBlackAndWhitePreviewsStyle();
    }
    
    // Test Ollama connection
    testOllamaConnection();
    
    // Set up hover event detection for video previews
    setupHoverEventDetection();
    
    // Set up mutation observer for dynamic content
    setupMutationObserver();
    
    // Set up extra observer for YouTube navigation events
    setupExtraObserver();
    
    // Track watch time
    if (config.notifyWatchTime) {
      startWatchTimeTracking();
    }
  }
  
  // Process content as it appears on the page
  const processNewContent = debounce(() => {
    if (config.enableCategoryFiltering) {
      applyCategoriesToVisibleVideos();
    }
    processThumbnails();
    processTitles();
    applyBlackAndWhiteToVideoPreviews();
    
    // Hide shorts if configured
    if (config.hideShorts) {
      hideAllShorts();
    }
    
    // Hide ads if configured
    if (config.hideAds) {
      const ads = document.querySelectorAll('ytd-promoted-video-renderer:not(.ytd-focus-processed)');
      ads.forEach(ad => {
        ad.classList.add('ytd-focus-processed');
        ad.style.display = 'none';
      });
    }
  }, 250); // 250ms debounce time
  
  // Test Ollama connection
  function testOllamaConnection() {
    if (!useOllamaForTitles()) {
      debugLog('Ollama integration not enabled, skipping connection test');
      return;
    }
    
    debugLog('Testing Ollama connection...');
    
    fetch(`${config.ollamaEndpoint}/health`)
      .then(response => {
        if (!response.ok) throw new Error(`Status: ${response.status}`);
        return response.json();
      })
      .then(data => {
        debugLog('Ollama health check successful:', data);
        
        // Test with a sample title
        return processOllamaTitle('YOU WON\'T BELIEVE WHAT HAPPENED NEXT!!!');
      })
      .then(result => {
        debugLog('Test title transformation result:', result);
      })
      .catch(error => {
        debugLog('Ollama connection test failed:', error);
      });
  }
  
  // Add CSS styles to block shorts elements immediately
  function addShortsBlockingStyles() {
    // Check if we already added the style
    if (document.getElementById('ytd-focus-shorts-style')) return;
    
    debugLog('Adding shorts blocking styles');
    
    // Create and add the style element
    const style = document.createElement('style');
    style.id = 'ytd-focus-shorts-style';
    style.textContent = `
      /* Hide specific Shorts elements - be careful not to hide all video content */
      ytd-rich-shelf-renderer[is-shorts],
      ytd-reel-item-renderer,
      ytd-shorts,
      ytd-shorts-video-renderer,
      ytd-shorts-carousel-renderer,
      ytd-guide-entry-renderer tp-yt-paper-item[title="Shorts"],
      ytd-mini-guide-entry-renderer[aria-label*="Shorts"],
      ytd-guide-entry-renderer[title*="Shorts"] {
        display: none !important;
      }
      
      /* Hide shorts links */
      a[href^="/shorts/"] {
        display: none !important;
      }
      
      /* Hide shorts sections in feeds - be specific */
      ytd-rich-section-renderer ytd-rich-shelf-renderer[is-shorts],
      ytd-rich-section-renderer ytd-shorts-carousel-renderer {
        display: none !important;
      }
      
      /* Hide shorts buttons in the header */
      ytd-masthead #shorts-button {
        display: none !important;
      }
    `;
    
    document.head.appendChild(style);
  }
  
  // Function to hide all shorts content
  function hideAllShorts() {
    debugLog('Selectively hiding shorts content');
    
    // Target specific shorts containers by various attributes and selectors
    const shortsSelectors = [
      // Main shorts shelf
      'ytd-rich-shelf-renderer[is-shorts]',
      // Individual shorts items
      'ytd-reel-item-renderer',
      'ytd-shorts',
      'ytd-shorts-video-renderer',
      'ytd-shorts-carousel-renderer',
      // Shorts in sidebar/guide
      'ytd-guide-entry-renderer tp-yt-paper-item[title="Shorts"]',
      'ytd-mini-guide-entry-renderer[aria-label*="Shorts"]',
      // Shorts tab in the sidebar/guide
      'ytd-guide-entry-renderer[title*="Shorts"]'
    ];
    
    // Try to find and hide shorts elements
    try {
      // Combine all selectors and query them
      const shortsElements = document.querySelectorAll(shortsSelectors.join(', '));
      debugLog(`Found ${shortsElements.length} shorts elements to hide`);
      
      shortsElements.forEach(element => {
        element.style.display = 'none';
      });
      
      // Handle sidebar items with "Shorts" in the title
      document.querySelectorAll('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer').forEach(item => {
        const title = item.querySelector('#endpoint-title, .title');
        if (title && title.textContent === 'Shorts') {
          item.style.display = 'none';
        }
      });
      
      // Only hide rich sections that explicitly contain shorts
      document.querySelectorAll('ytd-rich-section-renderer').forEach(section => {
        // Look specifically for shorts content or shorts title
        if (section.querySelector('ytd-shorts, ytd-shorts-video-renderer, ytd-reel-item-renderer, a[href^="/shorts/"]')) {
          section.style.display = 'none';
        } else if (section.querySelector('#title, span')) {
          const title = section.querySelector('#title, span');
          if (title && title.textContent === 'Shorts') {
            section.style.display = 'none';
          }
        }
      });
      
      // Handle videos with shorts URLs
      document.querySelectorAll('a[href^="/shorts/"]').forEach(link => {
        const container = link.closest('ytd-grid-video-renderer, ytd-video-renderer, ytd-rich-item-renderer');
        if (container) {
          container.style.display = 'none';
        }
      });
      
    } catch (error) {
      debugLog('Error hiding shorts:', error);
    }
  }
  
  // Setup hover detection to catch thumbnail previews as they start playing
  function setupHoverEventDetection() {
    // We'll use event delegation since thumbnails are added dynamically
    document.addEventListener('mouseover', function(e) {
      // Find closest thumbnail element
      const thumbnail = e.target.closest('ytd-thumbnail, ytm-thumbnail-cover, .ytp-videowall-still');
      
      if (thumbnail) {
        // Set a timeout to check if a video appears after hover (typical for previews)
        const timeoutId = setTimeout(() => {
          if (config.blackAndWhitePreviews) {
            // Look for videos that appeared inside or near this thumbnail
            const newVideos = thumbnail.querySelectorAll('video:not(.ytd-focus-bw-processed)');
            if (newVideos.length > 0) {
              newVideos.forEach(video => {
                if (!video.closest('#movie_player') && 
                    !video.classList.contains('html5-main-video')) {
                  video.classList.add('ytd-focus-bw-processed');
                  video.style.filter = 'grayscale(100%)';
                }
              });
            }
            
            // Also look for ytm-thumbnail-cover elements
            const covers = thumbnail.querySelectorAll('ytm-thumbnail-cover:not(.ytd-focus-bw-processed)');
            covers.forEach(cover => {
              cover.classList.add('ytd-focus-bw-processed');
              cover.style.filter = 'grayscale(100%)';
            });
          }
        }, 200); // Small delay to allow preview to start
        
        hoverTimeouts.set(thumbnail, timeoutId);
      }
    });
    
    // Clear timeouts when mouse leaves
    document.addEventListener('mouseout', function(e) {
      const thumbnail = e.target.closest('ytd-thumbnail, ytm-thumbnail-cover, .ytp-videowall-still');
      if (thumbnail && hoverTimeouts.has(thumbnail)) {
        clearTimeout(hoverTimeouts.get(thumbnail));
        hoverTimeouts.delete(thumbnail);
      }
    });
  }
  
  function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }
  
  function createColorThumbnail(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width || 320;
    canvas.height = height || 180;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = getRandomColor();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL();
  }
  
  function deClickbaitTitle(title) {
    // Simple de-clickbaiting rules before we connect to local LLM
    let debaited = title;
    
    // Remove all-caps sections
    debaited = debaited.replace(/\b[A-Z]{3,}\b/g, function(match) {
      return match.toLowerCase();
    });
    
    // Remove excessive punctuation
    debaited = debaited.replace(/[!?]{2,}/g, '.');
    
    // Remove common clickbait phrases
    const clickbaitPhrases = [
      "you won't believe", 
      "mind blowing", 
      "shocking", 
      "insane", 
      "amazing", 
      "the truth about",
      "will shock you",
      "changed my life",
      "i can't believe",
      "nobody is talking about"
    ];
    
    clickbaitPhrases.forEach(phrase => {
      debaited = debaited.replace(new RegExp(phrase, 'gi'), '');
    });
    
    // Clean up any double spaces created by removals
    debaited = debaited.replace(/\s{2,}/g, ' ').trim();
    
    // If we've stripped too much, just return original with a "[Clickbait]" prefix
    if (debaited.length < 10 && title.length > 20) {
      return "[Clickbait] " + title;
    }
    
    return debaited || title;
  }
  
  function shouldBlockContent(text) {
    if (!config.keywordBlocking || !config.blockedKeywords.length) return false;
    return config.blockedKeywords.some(keyword => 
      text.toLowerCase().includes(keyword.toLowerCase())
    );
  }
  
  function processThumbnails() {
    debugLog('Processing thumbnails');
    
    // Expanded selector to catch more thumbnail types
    const thumbnails = document.querySelectorAll(`
      ytd-thumbnail:not(.ytd-focus-processed), 
      ytd-rich-thumbnail-renderer:not(.ytd-focus-processed),
      ytd-compact-video-renderer img:not(.ytd-focus-processed),
      ytd-grid-video-renderer img:not(.ytd-focus-processed),
      ytd-rich-item-renderer img:not(.ytd-focus-processed),
      ytd-video-renderer img:not(.ytd-focus-processed),
      ytd-compact-playlist-renderer img:not(.ytd-focus-processed),
      ytd-playlist-renderer img:not(.ytd-focus-processed),
      ytd-playlist-panel-video-renderer img:not(.ytd-focus-processed),
      ytd-reel-item-renderer img:not(.ytd-focus-processed)
    `);
    
    debugLog(`Found ${thumbnails.length} thumbnails to process`);
    
    thumbnails.forEach(thumbnail => {
      // Skip if null (sometimes happens with dynamic content)
      if (!thumbnail) return;
      
      // Mark as processed
      thumbnail.classList.add('ytd-focus-processed');
      
      // Process the thumbnail
      if (config.replaceThumbnails) {
        // If this is an img already, use it directly
        const img = thumbnail.tagName === 'IMG' ? thumbnail : thumbnail.querySelector('img[src]');
        if (img && img.src && !img.src.startsWith('data:image')) {
          // Store original src for toggling if not already stored
          if (!img.dataset.originalSrc) {
            img.dataset.originalSrc = img.src;
          }
          img.src = createColorThumbnail(img.width || 320, img.height || 180);
          img.classList.add('ytd-focus-thumbnail');
        }
      }
      
      // Check if this is in a shorts container - expanded selector
      const shortsContainer = thumbnail.closest('[is-shorts], [href*="/shorts/"]');
      if (shortsContainer && config.hideShorts) {
        const videoContainer = thumbnail.closest(`
          ytd-grid-video-renderer, ytd-rich-item-renderer, 
          ytd-video-renderer, ytd-compact-video-renderer,
          ytd-reel-item-renderer, yt-horizontal-list-renderer,
          ytd-shelf-renderer
        `);
        if (videoContainer) {
          videoContainer.style.display = 'none';
        }
      }
      
      // Process video category
      if (config.enableCategoryFiltering) {
        processVideoCategory(thumbnail);
      }
    });
  }
  
  function modifyHomePage() {
    debugLog('Modifying home page');
    
    // Apply immediate processing
    processThumbnails();
    processTitles();
    
    // Hide Shorts content if configured
    if (config.hideShorts) {
      hideAllShorts();
    }
    
    // Hide trending section if configured
    if (config.hideTrending) {
      const trendingSections = document.querySelectorAll('ytd-rich-section-renderer');
      trendingSections.forEach(section => {
        if (section.textContent.toLowerCase().includes('trend')) {
          section.style.display = 'none';
        }
      });
    }
    
    // Add remaining features with a small delay to ensure the page is loaded
    setTimeout(() => {
      // Add focus mode if enabled
      if (config.enableFocusMode) {
        const sidebar = document.querySelector('ytd-guide-renderer');
        if (sidebar) {
          sidebar.style.width = '0';
          sidebar.style.overflow = 'hidden';
          
          // Add a toggle button
          const toggleButton = document.createElement('button');
          toggleButton.textContent = '☰';
          toggleButton.classList.add('ytd-focus-toggle');
          toggleButton.addEventListener('click', () => {
            if (sidebar.style.width === '0px') {
              sidebar.style.width = '240px';
              toggleButton.textContent = '✕';
            } else {
              sidebar.style.width = '0';
              toggleButton.textContent = '☰';
            }
          });
          
          const header = document.querySelector('ytd-masthead');
          if (header && !document.querySelector('.ytd-focus-toggle')) {
            header.appendChild(toggleButton);
          }
        }
      }
      
      // Setup category filter UI if enabled
      if (config.enableCategoryFiltering) {
        createCategoryFilterUI();
        applyCategoriesToVisibleVideos();
      }
      
      // Process thumbnails and titles again after delay
      processThumbnails();
      processTitles();
    }, 1000);
  }
  
  function modifyWatchPage() {
    debugLog('Modifying watch page');
    
    // Apply immediate processing
    processThumbnails();
    processTitles();
    
    // Hide Shorts content if configured
    if (config.hideShorts) {
      hideAllShorts();
    }
    
    // Hide recommendations if configured
    if (config.hideRecommendations) {
      const recommendations = document.querySelector('ytd-watch-next-secondary-results-renderer');
      if (recommendations) {
        recommendations.style.display = 'none';
      }
    }
    
    // Hide comments if configured
    if (config.hideComments) {
      const comments = document.querySelector('ytd-comments');
      if (comments) {
        comments.style.display = 'none';
      }
    }
    
    // Add watch time tracker
    startWatchTimeTracking();
    
    // Add remaining features with a delay
    setTimeout(() => {
      // Setup category filter UI if enabled
      if (config.enableCategoryFiltering) {
        createCategoryFilterUI();
        applyCategoriesToVisibleVideos();
      }
      
      // Process thumbnails and titles again after delay
      processThumbnails();
      processTitles();
    }, 1000);
  }
  
  function modifyShortsPage() {
    debugLog('On shorts page - redirecting if needed');
    
    // If shorts are to be hidden, redirect to home page
    if (config.hideShorts) {
      window.location.href = '/';
      return;
    }
    
    // Otherwise modify the shorts experience
    setTimeout(() => {
      // Add watch time tracker
      startWatchTimeTracking();
    }, 1000);
  }
  
  function modifySearchResults() {
    debugLog('Modifying search results page');
    
    // Apply immediate processing
    processThumbnails();
    processTitles();
    
    // Hide Shorts content if configured
    if (config.hideShorts) {
      hideAllShorts();
    }
    
    // Hide ads if configured
    if (config.hideAds) {
      const ads = document.querySelectorAll('ytd-promoted-video-renderer');
      ads.forEach(ad => {
        ad.style.display = 'none';
      });
    }
    
    // Add remaining features with a delay
    setTimeout(() => {
      // Setup category filter UI if enabled
      if (config.enableCategoryFiltering) {
        createCategoryFilterUI();
        applyCategoriesToVisibleVideos();
      }
      
      // Process thumbnails and titles again after delay
      processThumbnails();
      processTitles();
    }, 1000);
  }
  
  // Setup MutationObserver to catch dynamic content
  function setupMutationObserver() {
    debugLog('Setting up mutation observer');
    
    // Set up IntersectionObserver to detect when elements come into view
    const intersectionObserver = new IntersectionObserver((entries) => {
      if (entries.some(entry => entry.isIntersecting)) {
        processNewContent();
      }
    }, {
      root: null,
      rootMargin: '500px', // Look ahead/behind by 500px
      threshold: 0.1
    });

    // Observe specific containers that YouTube uses for video content
    function observeVideoContainers() {
      const containers = document.querySelectorAll(`
        #contents, 
        ytd-rich-grid-renderer, 
        ytd-watch-next-secondary-results-renderer,
        ytd-browse,
        ytd-two-column-browse-results-renderer,
        ytd-section-list-renderer,
        yt-horizontal-list-renderer,
        ytd-grid-renderer,
        ytd-item-section-renderer,
        ytd-shelf-renderer,
        ytd-playlist-panel-renderer,
        ytd-playlist-video-list-renderer
      `);
      containers.forEach(container => {
        if (container) {
          intersectionObserver.observe(container);
        }
      });
    }

    // Initial observation
    observeVideoContainers();

    // Observer for dynamic content changes that might add new containers
    const domObserver = new MutationObserver((mutations) => {
      let shouldProcess = false;
      let newContainers = false;
      
      mutations.forEach(mutation => {
        if (mutation.addedNodes.length > 0) {
          shouldProcess = true;
          
          // Check if any new video containers were added
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) { // Element node
              if (node.id === 'contents' || 
                  node.tagName?.toLowerCase() === 'ytd-rich-grid-renderer' || 
                  node.tagName?.toLowerCase() === 'ytd-watch-next-secondary-results-renderer' ||
                  node.tagName?.toLowerCase().includes('ytd-') ||  // Catch any ytd element
                  node.tagName?.toLowerCase().includes('yt-') ||   // Catch any yt element
                  node.classList?.contains('ytd-thumbnail') ||
                  node.classList?.contains('ytp-') ||
                  (node.tagName === 'VIDEO') ||
                  node.querySelector?.('video, [data-preview]')) {
                newContainers = true;
              }
              
              // Also check children for these container elements or videos
              const innerContainers = node.querySelectorAll(`
                #contents, 
                ytd-rich-grid-renderer, 
                ytd-watch-next-secondary-results-renderer,
                video,
                [data-preview],
                ytm-thumbnail-cover,
                ytd-thumbnail-overlay-toggle-button-renderer,
                ytd-thumbnail
              `);
              if (innerContainers.length > 0) {
                newContainers = true;
              }
            }
          });
        }
      });
      
      if (shouldProcess) {
        processNewContent();
        applyBlackAndWhiteToVideoPreviews(); // Explicitly process previews on every mutation
      }
      
      if (newContainers) {
        observeVideoContainers();
      }
      
      // Run the shorts hiding regardless if it's enabled
      if (config.hideShorts) {
        hideAllShorts();
      }
    });
    
    domObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Also handle scroll events since YouTube loads content on scroll
    window.addEventListener('scroll', debounce(() => {
      processNewContent();
      
      // Apply shorts hiding on scroll if enabled
      if (config.hideShorts) {
        hideAllShorts();
      }
    }, 500)); // Larger debounce time for scroll events
  }
  
  function startWatchTimeTracking() {
    if (!isWatching) {
      isWatching = true;
      watchStartTime = new Date();
      
      watchTimeInterval = setInterval(() => {
        const now = new Date();
        const sessionMinutes = Math.floor((now - watchStartTime) / 60000);
        totalWatchTime = sessionMinutes;
        
        // Check if we've exceeded the max watch time
        if (config.maxWatchTime > 0 && totalWatchTime >= config.maxWatchTime) {
          clearInterval(watchTimeInterval);
          
          // Create watch time notification
          const notification = document.createElement('div');
          notification.classList.add('ytd-focus-notification');
          notification.innerHTML = `
            <div class="ytd-focus-notification-content">
              <h3>Watch Time Limit Reached</h3>
              <p>You've been watching YouTube for ${totalWatchTime} minutes.</p>
              <button id="ytd-focus-continue">Continue Watching</button>
              <button id="ytd-focus-exit">Exit YouTube</button>
            </div>
          `;
          
          document.body.appendChild(notification);
          
          // Add button event listeners
          document.getElementById('ytd-focus-continue').addEventListener('click', () => {
            notification.remove();
            // Reset the timer for another session
            watchStartTime = new Date();
            watchTimeInterval = setInterval(() => {
              const now = new Date();
              const sessionMinutes = Math.floor((now - watchStartTime) / 60000);
              totalWatchTime = sessionMinutes;
              // Additional check logic here if needed
            }, 60000);
          });
          
          document.getElementById('ytd-focus-exit').addEventListener('click', () => {
            window.location.href = 'https://www.google.com';
          });
        }
      }, 60000); // Check every minute
    }
  }
  
  function stopWatchTimeTracking() {
    if (isWatching) {
      isWatching = false;
      clearInterval(watchTimeInterval);
      watchTimeInterval = null;
    }
  }
  
  // Add these new functions for black and white preview videos
  function addBlackAndWhitePreviewsStyle() {
    // Check if we already added the style
    if (document.getElementById('ytd-focus-bw-style')) return;
    
    // Create and add the style element
    const style = document.createElement('style');
    style.id = 'ytd-focus-bw-style';
    style.textContent = `
      /* Target preview videos that appear on hover (but NOT the main video player) */
      ytm-thumbnail-cover, 
      ytd-thumbnail-overlay-toggle-button-renderer video,
      ytd-thumbnail-overlay-inline-unplayable-renderer video,
      ytd-thumbnail-overlay-hover-text-renderer video,
      ytd-thumbnail-overlay-now-playing-renderer video,
      ytd-thumbnail-overlay-time-status-renderer video,
      ytd-thumbnail-overlay-loading-preview-renderer video,
      ytd-thumbnail-overlay-side-panel-renderer video,
      ytd-hover-overlay-renderer video,
      ytd-movie-renderer .ytd-thumbnail-overlay-hover-text-renderer,
      ytd-thumbnail-overlay-hover-inner-renderer video,
      ytd-thumbnail-overlay-inline-playback-renderer video,
      .ytd-thumbnail-overlay-playback-status-renderer video,
      ytd-video-preview video,
      .ytd-moving-thumbnail-renderer,
      ytd-thumbnail[hover-overlays]:hover video,
      .ytp-videowall-still-info-content .ytp-videowall-still-image .ytp-videowall-still-info-hover {
        filter: grayscale(100%) !important;
      }
      
      /* Target preview containers */
      ytd-video-preview,
      ytd-thumbnail-overlay-inline-playback-renderer,
      ytd-thumbnail-overlay-loading-preview-renderer,
      .ytd-moving-thumbnail-renderer,
      ytd-moving-thumbnail-renderer {
        filter: grayscale(100%) !important;
      }
      
      /* Explicitly exclude the main video player */
      #movie_player:not(.ytp-small-mode) video,
      .html5-main-video,
      #player-container-inner video,
      ytd-watch-flexy #player video {
        filter: none !important;
      }
    `;
    
    document.head.appendChild(style);
  }
  
  function applyBlackAndWhiteToVideoPreviews() {
    if (!config.blackAndWhitePreviews) return;
    
    // For dynamically added previews, target their containers
    const previewElements = document.querySelectorAll(`
      ytm-thumbnail-cover:not(.ytd-focus-bw-processed),
      video:not(.ytd-focus-bw-processed):not(.html5-main-video):not([id="movie_player"] video),
      .ytp-inline-preview-player:not(.ytd-focus-bw-processed),
      ytd-video-preview:not(.ytd-focus-bw-processed),
      ytd-moving-thumbnail-renderer:not(.ytd-focus-bw-processed),
      ytd-thumbnail-overlay-toggle-button-renderer:not(.ytd-focus-bw-processed),
      ytd-thumbnail-overlay-inline-unplayable-renderer:not(.ytd-focus-bw-processed),
      ytd-thumbnail-overlay-hover-text-renderer:not(.ytd-focus-bw-processed),
      ytd-thumbnail-overlay-now-playing-renderer:not(.ytd-focus-bw-processed),
      ytd-thumbnail-overlay-time-status-renderer:not(.ytd-focus-bw-processed),
      ytd-thumbnail-overlay-loading-preview-renderer:not(.ytd-focus-bw-processed),
      ytd-thumbnail-overlay-side-panel-renderer:not(.ytd-focus-bw-processed),
      ytd-hover-overlay-renderer:not(.ytd-focus-bw-processed)
    `);
    
    previewElements.forEach(preview => {
      preview.classList.add('ytd-focus-bw-processed');
      
      // Add the grayscale directly to elements as well (belt and suspenders approach)
      if (!preview.closest('#movie_player') && 
          !preview.classList.contains('html5-main-video') && 
          !preview.closest('ytd-watch-flexy #player')) {
        preview.style.filter = 'grayscale(100%)';
      }
    });
  }
  
  // Handle navigation between YouTube pages
  window.addEventListener('yt-navigate-start', function() {
    stopWatchTimeTracking();
  });
  
  window.addEventListener('yt-navigate-finish', function() {
    // Re-initialize our plugin for the new page
    initializePlugin();
  });
  
  // Listen for messages from popup or background
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    // Always send a response to prevent connection error
    sendResponse({status: "received"});
    
    if (message.action === 'configUpdated') {
      chrome.storage.sync.get('youtubeFocusConfig', function(data) {
        if (data.youtubeFocusConfig) {
          const oldConfig = {...config};
          config = { ...config, ...data.youtubeFocusConfig };
          
          // Update black and white preview setting
          if (config.blackAndWhitePreviews) {
            addBlackAndWhitePreviewsStyle();
          } else {
            // Remove the style if disabled
            const styleElement = document.getElementById('ytd-focus-bw-style');
            if (styleElement) styleElement.remove();
          }
          
          // Update shorts blocking setting
          if (config.hideShorts) {
            addShortsBlockingStyles();
            hideAllShorts();
            debugLog('Shorts hiding enabled');
            
            // Update UI toggle if it exists
            const shortsToggle = document.querySelector('.ytd-focus-shorts-toggle input[type="checkbox"]');
            if (shortsToggle) {
              shortsToggle.checked = true;
            }
            
            // Additional code from user to hide shorts sections
            let shortsSections = document.querySelectorAll("ytd-rich-section-renderer");
            shortsSections.forEach(section => section.style.display = "none");
            
            // Set up additional MutationObserver for Shorts
            setupExtraShortsObserver();
          } else if (oldConfig.hideShorts && !config.hideShorts) {
            // Remove the style if disabled
            const styleElement = document.getElementById('ytd-focus-shorts-style');
            if (styleElement) styleElement.remove();
            
            // Unhide any hidden shorts elements
            document.querySelectorAll('[style*="display: none"]').forEach(el => {
              // Only restore elements that were hidden by our shorts hiding
              if (el.matches('ytd-rich-section-renderer, ytd-reel-item-renderer, [is-shorts], a[href^="/shorts"], ytd-video-renderer[is-shorts]')) {
                el.style.display = '';
              }
            });
            
            // Update UI toggle if it exists
            const shortsToggle = document.querySelector('.ytd-focus-shorts-toggle input[type="checkbox"]');
            if (shortsToggle) {
              shortsToggle.checked = false;
            }
            
            debugLog('Shorts hiding disabled');
          }
        }
      });
    }
    
    // Add explicit toggle for shorts visibility
    if (message.action === 'toggleShorts') {
      config.hideShorts = !config.hideShorts;
      
      // Update UI toggle if it exists
      const shortsToggle = document.querySelector('.ytd-focus-shorts-toggle input[type="checkbox"]');
      if (shortsToggle) {
        shortsToggle.checked = config.hideShorts;
      }
      
      if (config.hideShorts) {
        addShortsBlockingStyles();
        hideAllShorts();
        debugLog('Shorts toggled: now hidden');
        
        // Additional code from user to hide shorts sections
        let shortsSections = document.querySelectorAll("ytd-rich-section-renderer");
        shortsSections.forEach(section => section.style.display = "none");
        
        // Set up additional MutationObserver for Shorts
        setupExtraShortsObserver();
      } else {
        const styleElement = document.getElementById('ytd-focus-shorts-style');
        if (styleElement) styleElement.remove();
        
        // Unhide any hidden shorts elements
        const shortsSelectors = [
          'ytd-rich-shelf-renderer[is-shorts]',
          'ytd-reel-item-renderer',
          'ytd-guide-entry-renderer[title*="Shorts"]',
          'ytd-rich-section-renderer ytd-rich-shelf-renderer[is-shorts]',
          '[is-shorts]',
          '[href*="/shorts/"]',
          'a[href^="/shorts"]',
          'ytd-video-renderer[is-shorts]',
          'yt-chip-cloud-chip-renderer[title="Shorts"]',
          'ytd-shelf-renderer[is-shorts]',
          'ytd-rich-section-renderer'
        ];
        
        document.querySelectorAll(shortsSelectors.join(', ')).forEach(el => {
          el.style.display = '';
        });
        
        debugLog('Shorts toggled: now visible');
      }
      
      // Save the updated setting
      chrome.storage.sync.get('youtubeFocusConfig', function(data) {
        const updatedConfig = data.youtubeFocusConfig || {};
        updatedConfig.hideShorts = config.hideShorts;
        
        chrome.storage.sync.set({ 'youtubeFocusConfig': updatedConfig }, function() {
          debugLog('Saved shorts visibility setting:', config.hideShorts);
        });
      });
    }
    
    if (message.action === 'toggleThumbnails') {
      const thumbnails = document.querySelectorAll('.ytd-focus-thumbnail');
      thumbnails.forEach(img => {
        if (img.src.startsWith('data:image')) {
          img.src = img.dataset.originalSrc;
        } else {
          img.src = createColorThumbnail(img.width, img.height);
        }
      });
    }
    
    if (message.action === 'toggleTitles') {
      const titles = document.querySelectorAll('.ytd-focus-processed');
      titles.forEach(title => {
        if (title.textContent === title.dataset.originalText) {
          title.textContent = deClickbaitTitle(title.dataset.originalText);
        } else {
          title.textContent = title.dataset.originalText;
        }
      });
    }
    
    if (message.action === 'toggleBlackAndWhitePreviews') {
      config.blackAndWhitePreviews = !config.blackAndWhitePreviews;
      
      if (config.blackAndWhitePreviews) {
        addBlackAndWhitePreviewsStyle();
      } else {
        const styleElement = document.getElementById('ytd-focus-bw-style');
        if (styleElement) styleElement.remove();
      }
    }
    
    if (message.action === 'updateCategoryFilters') {
      config.enableCategoryFiltering = message.enableCategoryFiltering;
      config.visibleCategories = message.visibleCategories;
      
      debugLog('Category filters updated', {
        enabled: config.enableCategoryFiltering,
        visible: config.visibleCategories
      });
      
      // Update UI if needed
      if (config.enableCategoryFiltering) {
        if (!document.querySelector('.ytd-focus-category-filter')) {
          createCategoryFilterUI();
        }
        filterVideosByCategory();
      } else {
        // Show all videos if categories are disabled
        document.querySelectorAll('[data-category]').forEach(container => {
          container.style.display = '';
        });
        
        // Hide the filter UI
        const filterUI = document.querySelector('.ytd-focus-category-filter');
        if (filterUI) {
          filterUI.style.display = 'none';
        }
      }
    }
    
    // Add Ollama model list fetcher
    if (message.action === 'fetchOllamaModels') {
      if (config.ollamaEndpoint) {
        fetch(`${config.ollamaEndpoint}/models`)
          .then(response => {
            if (!response.ok) throw new Error('Failed to fetch models');
            return response.json();
          })
          .then(data => {
            chrome.runtime.sendMessage({
              action: 'ollamaModelsFetched',
              models: data.models
            });
          })
          .catch(error => {
            debugLog('Error fetching Ollama models:', error);
            chrome.runtime.sendMessage({
              action: 'ollamaModelsFetched',
              error: error.message
            });
          });
      }
    }
  });
  
  // Start the script with immediate initialization
  immediateInit();
  
  // Then load config and continue with full initialization
  loadConfig();
})();