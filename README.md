# 🏪 Merchant Realms

A medieval open-world merchant simulation built with HTML5 Canvas and vanilla JavaScript.

## 🎮 Play Now

**[► Play Merchant Realms](https://configmancooper.github.io/MerchantRealms/)**

## About

Trade goods between kingdoms, build a merchant empire, navigate politics, hire workers, buy property, raise a family, and shape the world around you.

### Features
- 🌍 Procedurally generated world with multiple kingdoms
- ⚖️ Dynamic trade economy with supply/demand
- 🏠 Buy property, build businesses, hire workers
- ⚔️ Kingdom politics, wars, laws, and diplomacy
- 👨‍👩‍👧‍👦 Family system with marriage, children, inheritance, and regency
- 🎭 6 unique origin stories with special objectives
- 📜 19-chapter interactive tutorial
- 💾 5 save slots with download/upload support
- 🗡️ Dark deeds: assassination, sabotage, smuggling, and intrigue
- 👑 Rise from commoner to king through politics, rebellion, or marriage
- 🏴 Toll roads, trade wars, and kingdom-spanning conflicts
- 📖 19-chapter interactive story mode with voiced dialog

### Unique Starts
- ⛓️ **Indentured Servant** — Bound for 7 years. Find your way to freedom.
- 🙏 **Religious Pilgrim** — Visit holy sites and spread the faith.
- 🌊 **Shipwrecked Foreigner** — A stranger in a strange land.
- 🎵 **Traveling Musician** — Perform your way to fame.
- ⚔️ **Military Leader** — Rise through the ranks to become a general.
- 📚 **Scholar of the Ages** — Travel the world and write the Great Book.

## How to Play

Just click the link above! The game runs entirely in your browser — no installation needed.

### Controls
- **Click** buttons on the left panel to trade, build, work, etc.
- **Arrow keys / WASD / click-drag** to move the camera
- **Scroll wheel** to zoom in/out
- **Right-click** on the map to travel off-road
- **M** key to toggle map views
- **Escape** to close panels

## Running Locally

If you want to run it on your own machine (Node.js required):

1. Clone this repo
2. Start the bundled dev server:

   **Windows**
   ```
   .\start.ps1              # serves http://localhost:3000 and opens your browser
   .\start.ps1 -Port 3100   # use a different port
   .\start.ps1 -NoBrowser   # server only
   ```
   or double-click `start-game.bat`.

   **Any platform**
   ```
   node devserver.js        # honours the MR_PORT env var, defaults to 3000
   ```

3. Open `http://localhost:3000/`.

The dev server sends `no-store` cache headers, so a plain refresh always picks up your
latest edits. Opening `index.html` straight from disk mostly works, but some features
(WASM, audio, saves) need a real HTTP origin.

## License

All rights reserved. This game was created by Matthew Cooper.
