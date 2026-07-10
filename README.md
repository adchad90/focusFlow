# FocusFlow: MCP-Powered Personal Information Curation Engine

FocusFlow is a personal, lightweight backend daemon that acts as a zero-screentime aggregator and information filter. It reads a custom natural-language profile (`profile.md`), fetches raw feeds from subreddits and RSS feeds, and uses Gemini to filter out noise (memes, rants, minor news). It delivers high-priority updates instantly to your Discord feed and aggregates medium-priority items into a daily newsletter saved locally.

---

## 🏛️ System Architecture

FocusFlow separates resource fetching and delivery channels (exposing them as a standard **Model Context Protocol (MCP) Server**) from the AI intelligence layer (**MCP Client & Orchestrator**).

```
 ┌──────────────┐     ┌─────────────┐
 │  Reddit API  │     │  RSS Feeds  │
 └──────┬───────┘     └──────┬──────┘
        │                    │
 ┌──────▼────────────────────▼──────┐
 │     FocusFlow Custom MCP Server  │◄─────────┐
 └──────┬────────────────────▲──────┘          │
        │                    │                 │
        │ (Stdio/JSON-RPC)   │ (Executes       │
        │                    │  Actions)       │
 ┌──────▼────────────────────┴──────┐          │
 │     FocusFlow MCP Client         │          │
 └──────────────┬───────────────────┘          │
                │                              │
 ┌──────────────▼───────────────────┐          │
 │    AI Orchestration Engine       ├──────────┤
 │    (Reads profile.md & Filters)  │          │
 └──────────────┬───────────────────┘          │
                │ (Using Gemini)               │
                ▼                              │
 ┌──────────────────────────────────┐          │
 │       Delivery Channels          ├──────────┘
 │  - Discord Alert (High Priority) │
 │  - Email Digest (HTML File)      │
 │  - Google Calendar Blocker       │
 └──────────────────────────────────┘
```

---

## 🚀 Getting Started

### 1. Installation

Install Node.js dependencies:
```bash
npm install
```

### 2. Configuration

1. Copy the example configuration:
   ```bash
   cp config.json.example config.json
   ```
2. Open `config.json` and configure your API keys:
   - **`GEMINI_API_KEY`**: Get a free API Key from Google AI Studio. FocusFlow uses `gemini-2.5-flash` for high-speed, cost-effective filtering.
   - **`DISCORD_WEBHOOK_URL`**: Create a webhook in your personal Discord server and paste it here to receive instant updates.
   - *Note: Reddit and RSS feeds are fetched using public anonymous APIs; no Reddit API credentials are required for standard operation!*

### 3. Personalizing Your Filter Profile

Open `profile.md` and customize your information interests:
- Add or remove Subreddits (under `### Subreddits`).
- Add or remove RSS feed URLs (under `### RSS Feeds`).
- Define natural-language rules for what you care about under **What is IMPORTANT** and what to filter out under **What is NOISE**.

---

## 🛠️ How to Run

### Test Run (Dry-Run / Mock Mode)
Run a complete curation cycle using local synthetic news feeds to verify your filtering rules and webhook connections. **Does not require active Reddit/RSS scraping**:
```bash
npm run test-digest
```

### Run Curation Cycle Once
Run a live curation cycle, scraping active feeds from subreddits/RSS URLs, filtering them through Gemini, and sending updates:
```bash
npm start -- --run
```

### Run as Background Daemon
Runs an initial curation cycle, then runs periodically in the background every 6 hours:
```bash
npm start -- --daemon
```

### Expose as a Custom MCP Server
FocusFlow's tools can be plugged directly into standard MCP clients (like Claude Desktop or Cursor) to give your desktop AI assistant full capabilities to fetch Reddit, RSS, list your focus calendar, and dispatch webhooks:
```bash
npm start -- --server
```

---

## 📦 Features & Output Deliverables

*   **Discord Alerts**: High-priority events are posted to your Discord webhook as rich color-coded cards (Red for HIGH, Blue for MEDIUM) with summarized content and a link to the original article.
*   **Auto-Calendar Blocker**: If a high-priority item is classified as a "release date" or "launch event," FocusFlow schedules a placeholder blocker in your local calendar database (`calendar_db.json`).
*   **Email Digests**: Medium-priority posts are compiled into a beautiful responsive HTML digest and saved directly to the local `digests/digest_<timestamp>.html` folder.
