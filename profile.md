# FocusFlow User Profile

Edit this file to customize your information sources, interests, and filtering criteria. FocusFlow's Gemini LLM reads this file directly to understand your preferences.

## 1. Information Sources

### Subreddits
List subreddits you want to track, along with what you specifically look for in them.
- r/typescript: Core language updates, compiler releases, type-level programming deep dives.
- r/rust: New high-quality crates, compiler updates, performance optimization studies, tutorials on systems engineering.
- r/webdev: Major browser engine updates, web standard announcements (W3C/TC39), or major framework releases.

### RSS Feeds
List the raw RSS feed URLs you want to parse.
- https://news.ycombinator.com/rss (Hacker News RSS feed)
- https://dev.to/feed (Dev.to articles feed)

---

## 2. Topic Filters & Rules

### What is IMPORTANT (High Priority)
Specify topics, keywords, or types of content that should ALWAYS trigger a notification (e.g. Discord update or calendar entry):
- Announcements of major software versions (e.g. TypeScript 6.0, React 20, Rust 1.85).
- In-depth architectural case studies or post-mortems from reputable engineering teams (e.g. Figma, Netflix, GitHub, Vercel).
- Critical security vulnerabilities (CVEs) affecting widely-used packages.
- Breakthrough AI research, open-source models, or new agent architectures.

### What is NOISE (Filter Out)
Specify content that should be ignored entirely to save your focus:
- Entry-level tutorials (e.g. "How to write a loop", "Intro to HTML/CSS").
- Casual rants, venting, meme posts, and low-effort listicles (e.g. "10 extensions you need").
- Self-promotional bootcamps, paid course advertisements, or general job postings.
- Speculative financial news, cryptocurrency updates, or general political discussions.
- Minor minor-version package updates (e.g., a bugfix patch release of a small library).

---

## 3. Delivery Channels

- **Discord**: High-priority instant alerts (within minutes of run).
- **Email**: A daily consolidated summary of medium-priority articles (run once a day).
- **Google Calendar**: Critical events (like release dates, conference schedules) added directly to your calendar.
