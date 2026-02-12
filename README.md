# No Redirect (Detect Automatic)

![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)
![HTML5](https://img.shields.io/badge/html5-%23E34F26.svg?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/css3-%231572B6.svg?style=for-the-badge&logo=css3&logoColor=white)
![Google Chrome](https://img.shields.io/badge/Google%20Chrome-%234285F4.svg?style=for-the-badge&logo=Google-Chrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest%20V3-Check-green?style=for-the-badge)

A comprehensive Chrome extension that blocks unwanted redirects across **five** layers of web navigation. This extension provides automatic protection against network-level redirects, JavaScript-based redirects, meta refresh tags, popup redirects, and UI clickjacking.

## Features

### Five-Layer Protection System

1. **Network Layer (declarativeNetRequest)**
   - Blocks redirect requests at the network level before they execute
   - Filters common redirect patterns including tracking URLs and ad redirects
   - Minimal performance impact using Chrome's native declarativeNetRequest API

2. **Navigation Layer (webNavigation & Navigation API)**
   - **webNavigation**: Detects server-side and client-side redirects at the browser level.
   - **Navigation API**: Intercepts all client-side navigation attempts (`location.href`, `assign`, `replace`) directly in the main thread with robust cancellation.

3. **Injection Layer (Main World Protection)**
   - **Zombie Window Pattern**: Returns a non-functional proxy window object to malicious scripts using `window.open()`, preventing crashes and fallback redirects.
   - **Anti-Tampering**: Protects against scripts that try to bypass blocks.
   - Intercepts `setTimeout` based evaluations.

4. **Containment Layer (Form & Iframe Shield)**
   - **Iframe Lockdown**: Forces `sandbox` attributes on all iframes to prevent them from navigating the top window or opening popups.
   - **Form Hijacking Protection**: Scans and blocks form submissions with suspicious cross-origin actions.

5. **UI Shield (Interaction Protection)**
   - **Overlay Buster**: Uses MutationObservers to detect and instantly remove invisible "curtains" (overlays) used for clickjacking.
   - **Click Forensics**: Analyzes every click to ensure it's not a simulated script click (`isTrusted: false`) or targeting a hidden element.
   - **Anti-Tab-Under**: Prevents rapid focus switching tricks used by popups.



### User Interface

- **Dark Mode Design**: Premium glassmorphism UI with smooth animations
- **Real-time Statistics**: Session and total blocked redirect counters
- **Activity Log**: Recent blocks with type classification and timestamps
- **Toggle Control**: Easy enable/disable with visual feedback
- **Badge Indicator**: Extension icon shows active status and block count

## Installation

### From Source (Developer Mode)

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked**
5. Select the extension directory
6. The extension icon will appear in your toolbar

### Generating Icons

If you need to regenerate the extension icons, run the PowerShell script:

```powershell
.\generate_icons.ps1
```

This will create three icon sizes (16x16, 48x48, 128x128) in the `icons/` directory.

## Technical Architecture

### Manifest V3 Compliance

This extension uses Chrome's Manifest V3 architecture with:
- Service worker background script
- Declarative net request rules
- Content scripts in both isolated and main worlds
- Modern Chrome APIs (scripting, storage, webNavigation)

### Content Script Isolation

The extension uses a dual content script approach to overcome Chrome's isolated world limitations:

- **content.js** (Isolated World): Handles DOM observation, communication with background script, and meta refresh detection
- **content_main.js** (Main World): Runs in the page's JavaScript context to intercept native functions like `window.location` and `window.open`

Communication between worlds uses `window.postMessage`, ensuring blocked redirects are properly reported.

## Permissions

The extension requires the following permissions:

- `declarativeNetRequest`: Block network requests matching redirect patterns
- `declarativeNetRequestFeedback`: Debug feedback for rule matching (development only)
- `webNavigation`: Monitor navigation events and detect redirects
- `storage`: Persist settings and statistics
- `activeTab`: Access current tab information
- `tabs`: Manage tab state during redirect blocking
- `scripting`: Register main world content scripts
- `<all_urls>`: Apply protection across all websites

## File Structure

```
├── manifest.json              # Extension configuration
├── background.js              # Service worker (Layer 2: webNavigation)
├── content.js                 # Isolated world content script (DOM monitoring)
├── content_main.js            # Main world content script (JS interception)
├── rules.json                 # declarativeNetRequest rules (Layer 1)
├── popup.html                 # Extension popup interface
├── popup.js                   # Popup logic and statistics
├── popup.css                  # Popup styling (dark mode design)
├── generate_icons.ps1         # Icon generation script
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Development

### Building

No build process is required. The extension runs directly from source files.

### Testing

1. Load the extension in developer mode
2. Open the browser console and navigate to the service worker
3. Verify the logs show:
   - `[No Redirect] Service worker iniciado ✓`
   - `[No Redirect] Main world script registrado ✓`
4. Visit any webpage and check the page console for:
   - `[No Redirect] Content script ativo ✓`
   - `[No Redirect] Main world script ativo ✓`

### Debugging

- **Service Worker Console**: Click "service worker" link on extension card in `chrome://extensions/`
- **Content Script Console**: Open DevTools on any webpage
- **Popup Console**: Right-click extension icon → Inspect popup

## Known Limitations

- `declarativeNetRequestFeedback` permission only works in unpacked extensions (development mode)
- Main world content scripts require Chrome 102+ for `world: "MAIN"` support
- Some legitimate same-origin redirects may be blocked if they match suspicious patterns

## Privacy

This extension:
- Does not collect or transmit any user data
- Stores statistics locally using Chrome's storage API
- Does not make external network requests
- Operates entirely client-side

## License

MIT License - See LICENSE file for details

## Contributing

Contributions are welcome. Please ensure:
- Code follows existing style conventions
- Changes maintain Manifest V3 compliance
- New features include appropriate documentation

## Version History

### 1.3.0
- **5-Layer Architecture**: Officially separated "UI Shield" and "Containment" layers.
- **Overlay Buster**: Advanced "Invisible Curtain" detection and removal.
- **Click Forensics**: Enhanced protection against simulated clicks on empty links.

### 1.2.0
- **Total Shield Architecture**: Replaced fragile overrides with robust `Navigation API` interception.
- **Zombie Window Defense**: Neutralizes malicious popups by returning non-functional window proxies.
- **Form Hijacking Protection**: Blocks redirects via fake form submissions.
- **Audit Logging**: Enhanced logging with full URLs for detailed analysis.

### 1.1.0
- Added 4th protection layer: Iframe Lockdown & Strict `window.open` blocking
- Fixed issue with redirects spawning new windows
- Enhanced ad-overlay detection

### 1.0.0
- Initial release
- Three-layer redirect protection
- Dark mode UI with real-time statistics
- Support for all major redirect types
