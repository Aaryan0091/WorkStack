# WorkStack Tab Tracker Extension

## Step 2 Complete!

Extension files have been created in:
`/Users/aaryangupta/Desktop/workstack/workstack-extension/`

### Files Created:
- ✅ `manifest.json` - Extension configuration
- ✅ `background.js` - Tab tracking service worker
- ✅ `popup.html` - Popup UI
- ✅ `popup.js` - Popup logic
- ✅ `styles.css` - Popup styling
- ✅ `generate-icons.html` - Icon generator

---

## Step 3: Generate Icons & Load Extension

### 3a. Generate Icons
1. Open `generate-icons.html` in your browser
2. Click all three download buttons
3. Move the downloaded PNG files to the `icons/` folder

### 3b. Load Extension in Chrome
1. Open Chrome and go to `chrome://extensions/`
2. Toggle "Developer mode" (top right)
3. Click "Load unpacked"
4. Select this folder: `/Users/aaryangupta/Desktop/workstack/workstack-extension/`
5. **Copy the Extension ID** shown below the extension name

### 3c. Tell Me the Extension ID
Once you have the Extension ID, tell me and I'll:
- Update the manifest.json with your ID
- Create the API endpoint in your WorkStack app
- Update the "Track Activity" button

---

## What the Extension Does:
- Tracks which tabs you view
- Records URL, title, and time spent
- Syncs data to your WorkStack app
- Shows tracking status in popup
