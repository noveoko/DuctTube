// This is the core script that finds and hides the Shorts videos.

/**
 * Finds all video elements that are Shorts and hides them.
 * Shorts are identified by links that start with "/shorts/".
 * We then hide the entire video container element.
 */
function hideShortsElements() {
  // Select all anchor tags whose href attribute starts with "/shorts/"
  const shortsLinks = document.querySelectorAll('a[href^="/shorts/"]');

  shortsLinks.forEach(link => {
    // The link is usually nested deep inside the component that contains the video.
    // We need to find the main container element to hide the entire video preview.
    // These are the common tags for video containers on YouTube's pages.
    const videoContainer = link.closest('ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, ytd-video-renderer');

    if (videoContainer) {
      // Hide the entire container.
      videoContainer.style.display = 'none';
    }
  });
}

/**
 * YouTube loads content dynamically as you scroll. A MutationObserver
 * allows us to react to these changes and hide new Shorts as they appear.
 */
const observer = new MutationObserver((mutations) => {
  // We can debounce the function call for performance, but for this use case,
  // calling it directly is simple and effective.
  hideShortsElements();
});

// Start observing the entire document body for changes.
observer.observe(document.body, {
  childList: true, // Watch for new elements being added or removed.
  subtree: true    // Watch all descendants, not just direct children.
});

// Run the function once when the script is first injected,
// to hide any Shorts that are already on the page.
hideShortsElements();
