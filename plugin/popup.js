document.addEventListener('DOMContentLoaded', function() {
  // Load the current configuration
  chrome.storage.sync.get('youtubeFocusConfig', function(data) {
    const config = data.youtubeFocusConfig || {};
    
    // Set initial values in the form
    document.getElementById('replaceThumbnails').checked = config.replaceThumbnails !== false;
    document.getElementById('deClickbaitTitles').checked = config.deClickbaitTitles !== false;
    document.getElementById('hideShorts').checked = config.hideShorts === true;
    document.getElementById('hideRecommendations').checked = config.hideRecommendations === true;
    document.getElementById('hideTrending').checked = config.hideTrending !== false;
    document.getElementById('hideComments').checked = config.hideComments === true;
    document.getElementById('hideAds').checked = config.hideAds !== false;
    document.getElementById('keywordBlocking').checked = config.keywordBlocking !== false;
    document.getElementById('enableFocusMode').checked = config.enableFocusMode !== false;
    document.getElementById('maxWatchTime').value = config.maxWatchTime || 60;
    document.getElementById('useOllama').checked = config.useOllama === true;
    document.getElementById('ollamaEndpoint').value = config.ollamaEndpoint || 'http://localhost:8000';
    document.getElementById('ollamaModel').value = config.ollamaModel || 'llama3:8b';
    document.getElementById('blackAndWhitePreviews').checked = config.blackAndWhitePreviews !== false;
    
    // Display keywords
    const keywordsContainer = document.getElementById('keywordTags');
    keywordsContainer.innerHTML = '';
    
    if (config.blockedKeywords && config.blockedKeywords.length) {
      config.blockedKeywords.forEach(keyword => {
        addKeywordTag(keyword);
      });
    }
    
    // If Ollama is enabled, show the model selector
    if (config.useOllama) {
      document.getElementById('modelSelector').style.display = 'block';
    }
  });
  
  // Handle adding new keywords
  document.getElementById('newKeyword').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      const keyword = this.value.trim();
      if (keyword) {
        addKeywordTag(keyword);
        this.value = '';
      }
    }
  });
  
  // Handle test connection button
  document.getElementById('testConnection').addEventListener('click', function() {
    const endpoint = document.getElementById('ollamaEndpoint').value.trim();
    if (!endpoint) {
      updateConnectionStatus('error', 'Please enter an endpoint URL');
      return;
    }
    
    updateConnectionStatus('loading', 'Testing connection...');
    
    // Test the connection to the Ollama backend
    fetch(`${endpoint}/health`)
      .then(response => {
        if (!response.ok) throw new Error('Server returned an error response');
        return response.json();
      })
      .then(data => {
        if (data.status === 'healthy' && data.ollama.status === 'available') {
          updateConnectionStatus('success', `Connected successfully! Ollama v${data.ollama.version} is available.`);
          fetchModels(endpoint);
        } else {
          updateConnectionStatus('error', 'Ollama is not available on the backend');
        }
      })
      .catch(error => {
        console.error('Error testing connection:', error);
        updateConnectionStatus('error', `Connection failed: ${error.message}`);
      });
  });
  
  // Toggle the model selector based on useOllama checkbox
  document.getElementById('useOllama').addEventListener('change', function() {
    document.getElementById('modelSelector').style.display = this.checked ? 'block' : 'none';
    
    if (this.checked) {
      const endpoint = document.getElementById('ollamaEndpoint').value.trim();
      if (endpoint) {
        fetchModels(endpoint);
      }
    }
  });
  
  // Handle save button
  document.getElementById('saveButton').addEventListener('click', saveSettings);
  
  function updateConnectionStatus(type, message) {
    const statusElement = document.getElementById('connectionStatus');
    statusElement.innerHTML = '';
    statusElement.className = `status-message ${type}`;
    
    if (type === 'loading') {
      const loader = document.createElement('span');
      loader.className = 'loading';
      statusElement.appendChild(loader);
    }
    
    statusElement.appendChild(document.createTextNode(message));
  }
  
  function fetchModels(endpoint) {
    fetch(`${endpoint}/models`)
      .then(response => {
        if (!response.ok) throw new Error('Failed to fetch models');
        return response.json();
      })
      .then(data => {
        const modelSelect = document.getElementById('ollamaModel');
        modelSelect.innerHTML = '';
        
        // Add models to the dropdown
        if (data.models && data.models.length > 0) {
          data.models.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            modelSelect.appendChild(option);
          });
        } else {
          const option = document.createElement('option');
          option.value = 'llama3:8b';
          option.textContent = 'llama3:8b (default)';
          modelSelect.appendChild(option);
        }
      })
      .catch(error => {
        console.error('Error fetching models:', error);
        // Add a default option if we couldn't fetch models
        const modelSelect = document.getElementById('ollamaModel');
        modelSelect.innerHTML = '';
        const option = document.createElement('option');
        option.value = 'llama3:8b';
        option.textContent = 'llama3:8b (default)';
        modelSelect.appendChild(option);
      });
  }
  
  function addKeywordTag(keyword) {
    const tagsContainer = document.getElementById('keywordTags');
    
    const tag = document.createElement('div');
    tag.classList.add('tag');
    tag.innerHTML = keyword + '<button class="remove-tag">×</button>';
    
    tag.querySelector('.remove-tag').addEventListener('click', function() {
      tag.remove();
    });
    
    tagsContainer.appendChild(tag);
  }
  
  function saveSettings() {
    // Collect all current keywords
    const keywordTags = document.querySelectorAll('.tag');
    const keywords = Array.from(keywordTags).map(tag => tag.textContent.replace('×', '').trim());
    
    // Create the updated configuration
    const config = {
      replaceThumbnails: document.getElementById('replaceThumbnails').checked,
      deClickbaitTitles: document.getElementById('deClickbaitTitles').checked,
      hideShorts: document.getElementById('hideShorts').checked,
      hideRecommendations: document.getElementById('hideRecommendations').checked,
      hideTrending: document.getElementById('hideTrending').checked,
      hideComments: document.getElementById('hideComments').checked,
      hideAds: document.getElementById('hideAds').checked,
      keywordBlocking: document.getElementById('keywordBlocking').checked,
      blockedKeywords: keywords,
      enableFocusMode: document.getElementById('enableFocusMode').checked,
      maxWatchTime: parseInt(document.getElementById('maxWatchTime').value, 10) || 60,
      notifyWatchTime: true,
      useOllama: document.getElementById('useOllama').checked,
      ollamaEndpoint: document.getElementById('ollamaEndpoint').value,
      ollamaModel: document.getElementById('ollamaModel').value,
      blackAndWhitePreviews: document.getElementById('blackAndWhitePreviews').checked
    };
    
    // Save the configuration
    chrome.storage.sync.set({ 'youtubeFocusConfig': config }, function() {
      // Notify the active tab that settings have been updated
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs[0] && tabs[0].url.includes('youtube.com')) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'configUpdated' });
        }
      });
      
      // Provide visual feedback
      const saveButton = document.getElementById('saveButton');
      saveButton.textContent = 'Saved!';
      setTimeout(() => {
        saveButton.textContent = 'Save Settings';
      }, 1500);
    });
  }
  
  // Listen for messages from the content script
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.action === 'ollamaModelsFetched') {
      if (message.error) {
        updateConnectionStatus('error', `Failed to fetch models: ${message.error}`);
      } else if (message.models) {
        const modelSelect = document.getElementById('ollamaModel');
        modelSelect.innerHTML = '';
        
        message.models.forEach(model => {
          const option = document.createElement('option');
          option.value = model;
          option.textContent = model;
          modelSelect.appendChild(option);
        });
        
        updateConnectionStatus('success', `Loaded ${message.models.length} models`);
      }
    }
  });
});

// Define the categories and their colors - keep this in sync with content.js
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

// Initialize category UI
function initializeCategoryUI() {
  const enableCategoryFiltering = document.getElementById('enableCategoryFiltering');
  const categoryContainer = document.getElementById('categoryContainer');
  const categoriesList = document.getElementById('categoriesList');
  const toggleAllButton = document.getElementById('toggleAllCategories');
  
  // Clear any existing categories
  categoriesList.innerHTML = '';
  
  // Create a checkbox for each category
  Object.entries(VIDEO_CATEGORIES).forEach(([category, color]) => {
    const categoryItem = document.createElement('div');
    categoryItem.className = 'category-item';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `category-${category.replace(/\s+/g, '-').toLowerCase()}`;
    checkbox.value = category;
    checkbox.checked = true; // Default all to checked
    
    const colorDot = document.createElement('span');
    colorDot.className = 'color-dot';
    colorDot.style.backgroundColor = color;
    
    const label = document.createElement('label');
    label.htmlFor = checkbox.id;
    label.appendChild(colorDot);
    
    // Just use the main category name (before the dash)
    const displayName = category.split('–')[0].trim();
    label.appendChild(document.createTextNode(displayName));
    
    categoryItem.appendChild(checkbox);
    categoryItem.appendChild(label);
    categoriesList.appendChild(categoryItem);
  });
  
  // Show/hide category container based on enableCategoryFiltering
  enableCategoryFiltering.addEventListener('change', function() {
    categoryContainer.style.display = this.checked ? 'block' : 'none';
  });
  
  // Toggle all categories
  toggleAllButton.addEventListener('click', function() {
    const checkboxes = categoriesList.querySelectorAll('input[type="checkbox"]');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    
    checkboxes.forEach(checkbox => {
      checkbox.checked = !allChecked;
    });
  });
}

// Load category settings
function loadCategorySettings() {
  chrome.storage.sync.get(['youtubeFocusConfig', 'youtubeFocusVisibleCategories'], function(data) {
    const config = data.youtubeFocusConfig || {};
    const visibleCategories = data.youtubeFocusVisibleCategories || Object.keys(VIDEO_CATEGORIES);
    
    document.getElementById('enableCategoryFiltering').checked = config.enableCategoryFiltering !== false;
    document.getElementById('categoryContainer').style.display = 
      config.enableCategoryFiltering !== false ? 'block' : 'none';
    
    // Update checkboxes based on visible categories
    document.querySelectorAll('#categoriesList input[type="checkbox"]').forEach(checkbox => {
      checkbox.checked = visibleCategories.includes(checkbox.value);
    });
  });
}

// Save category settings
function saveCategorySettings() {
  const enableCategoryFiltering = document.getElementById('enableCategoryFiltering').checked;
  
  // Get all selected category checkboxes
  const visibleCategories = Array.from(
    document.querySelectorAll('#categoriesList input[type="checkbox"]:checked')
  ).map(checkbox => checkbox.value);
  
  // Update the config
  chrome.storage.sync.get('youtubeFocusConfig', function(data) {
    const config = data.youtubeFocusConfig || {};
    config.enableCategoryFiltering = enableCategoryFiltering;
    
    chrome.storage.sync.set({
      'youtubeFocusConfig': config,
      'youtubeFocusVisibleCategories': visibleCategories
    }, function() {
      console.log('Category settings saved');
    });
  });
  
  // Notify the content script
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs[0] && tabs[0].url.includes('youtube.com')) {
      chrome.tabs.sendMessage(tabs[0].id, { 
        action: 'updateCategoryFilters',
        enableCategoryFiltering: enableCategoryFiltering,
        visibleCategories: visibleCategories
      });
    }
  });
}

// Add these calls to your document ready function
document.addEventListener('DOMContentLoaded', function() {
  // Initialize category UI
  initializeCategoryUI();
  
  // Load settings
  loadCategorySettings();
  
  // Add the category settings to the save function
  const saveButton = document.getElementById('saveButton');
  saveButton.addEventListener('click', function() {
    // Your existing save logic
    // ...
    
    // Add this to save the category settings
    saveCategorySettings();
  });
});