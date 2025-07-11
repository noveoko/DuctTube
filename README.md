![Yellow Duck with Blue Ducktape on Beak](YoutubeADD/icon.png)

# Ductube - Tame Your Social Media Feeds

**Ductube** is a browser extension designed to give you control over your social media experience. It's a collection of content filters that allows you to selectively hide annoying or distracting elements from various platforms, starting with YouTube.

## Our Philosophy

Social media should serve you, not the other way around. Ductube is built on the idea that users should have the final say on what they see. Whether it's clickbait, unwanted content formats, or distracting features, Ductube aims to provide the tools to filter them out, creating a cleaner, more focused browsing experience.

## Features

Ductube is designed to be a modular platform for various content filters.

### Current Filters:

- **YouTube Shorts Hider:** Automatically finds and hides all "YouTube Shorts" videos from your feed, search results, and channel pages, allowing you to focus on standard video content.

### Planned Filters:

- Hiding "For You" sections on various platforms.
- Filtering posts containing specific keywords.
- Blocking sponsored posts and "suggested for you" content that slips past ad-blockers.
- Filters for other platforms like Twitter, Facebook, and Instagram.

## Installation

Ductube is installed as an "unpacked extension" in your browser. Here’s how to get it running:

1. **Download the Files:** Create a folder on your computer named `Ductube` and save all the extension files (`manifest.json`, `background.js`, `content.js`, etc.) inside it.
2. **Open Browser Extensions:**
   - **Chrome:** Navigate to `chrome://extensions`.
   - **Firefox:** Navigate to `about:debugging#/runtime/this-firefox`.
   - **Edge:** Navigate to `edge://extensions`.
3. **Enable Developer Mode:** Find and enable the "Developer mode" switch, usually located in the corner of the page.
4. **Load the Extension:**
   - Click the **"Load unpacked"** (Chrome/Edge) or **"Load Temporary Add-on"** (Firefox) button.
   - Select the `Ductube` folder you created in the first step.
5. **Done!** The extension is now active. It will automatically apply its filters on supported websites.

## How It Works

The extension uses lightweight content scripts that run in your browser. When you load a supported web page, these scripts identify unwanted elements based on their specific HTML structure or links (like videos linking to `/shorts/`). Once identified, the elements are hidden from view without disrupting the rest of the page's layout.

## Contributing

This is an open-source project, and contributions are welcome! If you have an idea for a new filter or want to improve an existing one, please feel free to open an issue or submit a pull request on our repository.

**Ideas for contributions:**

- Suggest a new social media annoyance to filter.
- Help expand Ductube to work on other browsers.
- Improve the performance of existing filters.

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.
