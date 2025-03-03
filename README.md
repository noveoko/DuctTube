# DuctTube

DuctTube is a Chrome extension designed to enhance focus and reduce distractions while using YouTube. It gives you control over your YouTube experience by filtering out unwanted content, reducing clickbait, and providing tools to manage your viewing habits.

![YouTubeFocus Screenshot](duck_tube_logo.png)

## Features

- **Hide YouTube Shorts**: Toggle visibility of all Shorts content with a convenient switch
- **De-clickbait Video Titles**: Transform exaggerated titles into more factual descriptions
- **Replace Thumbnails**: Swap flashy thumbnails with simple color blocks to reduce visual distractions
- **Category Filtering**: Categorize and filter videos by content type
- **Black & White Previews**: Convert video previews to grayscale for less distraction
- **Focus Mode**: Hide the sidebar for a cleaner viewing experience
- **Watch Time Limits**: Set time limits for your YouTube sessions
- **Hide Trending & Recommendations**: Reduce algorithm-driven content suggestions
- **Block Content by Keywords**: Filter out videos containing specific keywords
- **Hide Comments**: Remove comments sections for distraction-free viewing
- **Hide Ads**: Automatically hide promotional content

## Installation

### From Chrome Web Store
1. Visit the [YouTubeFocus page](https://chrome.google.com/webstore/detail/youtubefocus/your-extension-id) on the Chrome Web Store
2. Click "Add to Chrome"
3. Confirm the installation when prompted

### Manual Installation (Developer Mode)
1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the extension directory
5. The extension should now be installed and active

## Usage

After installation, YouTubeFocus will automatically start working when you visit YouTube. You'll notice:

- A new floating menu in the top-right of the YouTube interface for category filtering and Shorts toggling
- Modified video titles and thumbnails (if enabled)
- Hidden Shorts content (if enabled)

### Controls

- **Category Filter**: Mouse over the filter menu in the top-right to see and manage content categories
- **Shorts Toggle**: Use the switch below categories to show/hide Shorts content
- **Focus Mode**: Click the hamburger icon (☰) added to the YouTube header to toggle sidebar visibility

## Configuration

YouTubeFocus can be configured through the extension popup. Click the extension icon in your browser toolbar to access settings:

- **Content Filtering**
  - Toggle thumbnail replacement
  - Toggle title de-clickbaiting
  - Toggle Shorts visibility
  - Toggle trending and recommendations
  - Toggle comments visibility
  - Toggle ads visibility
  
- **Keyword Blocking**
  - Add custom keywords to filter out videos
  
- **Watch Time Management**
  - Set maximum watch time limits
  - Enable/disable watch time notifications
  
- **Visual Settings**
  - Enable/disable black & white previews
  - Enable/disable focus mode

- **Advanced Settings**
  - Configure Ollama integration for AI-powered title transformation
  - Set Ollama endpoint and model

## Technical Details

YouTubeFocus works by modifying the YouTube interface in real-time using JavaScript. It:

1. Injects CSS to hide unwanted elements
2. Uses MutationObservers to detect and process dynamic content
3. Transforms video titles and thumbnails
4. Categorizes videos using pattern matching or AI (with Ollama)
5. Tracks watch time using browser storage

### AI Integration (Optional)

For enhanced title de-clickbaiting, YouTubeFocus can connect to a local Ollama instance:

1. Install [Ollama](https://ollama.ai/)
2. Run a supported model (default: llama3:8b)
3. Configure the Ollama endpoint in extension settings
4. Enable Ollama integration

## Troubleshooting

### Common Issues

- **Content not being filtered**: Try refreshing the page or disabling and re-enabling the extension
- **Menu not appearing**: Make sure you're on youtube.com and that no other extensions are conflicting
- **Ollama integration not working**: Check that Ollama is running and accessible at the configured endpoint

### Debug Mode

Enable debug mode in the extension settings to view detailed logs in the browser console. This can help identify issues with content filtering or Ollama integration.

## Development

### Project Structure

- `manifest.json`: Extension configuration
- `content.js`: Main content script that runs on YouTube
- `popup.html/js`: Extension popup interface
- `background.js`: Background script for message handling
- `styles`: CSS files for styling

### Building from Source

1. Clone the repository
2. Make your changes
3. Load the extension in developer mode

### Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Privacy

YouTubeFocus respects your privacy:
- All processing happens locally in your browser
- No data is sent to external servers (except to your local Ollama instance if configured)
- No usage tracking or analytics

## Credits

Created by [Your Name] with contributions from the open-source community.

---

**Note**: YouTubeFocus is not affiliated with or endorsed by YouTube or Google.
