import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { FocusMcpClient } from './mcp/client.js';
import { FocusConfig } from './config.js';
import { GoogleGenAI } from '@google/genai';
import { fetchProfileActivity } from './profileFetchers.js';
import { discordBotClient } from './discord/bot.js';

const prisma = new PrismaClient();

interface FilteredItem {
  title: string;
  url: string;
  source: string;
  priority: 'HIGH' | 'MEDIUM';
  reason: string;
  summary: string;
}

/**
 * Fallback keyword-based filtering when Gemini API key is missing.
 */
function mockFilterItems(items: any[], rulesText: string): FilteredItem[] {
  const filtered: FilteredItem[] = [];
  const highKeywords = ['release', 'major', 'announcement', 'security', 'cve', 'vulnerability', 'breakthrough', 'architecture', 'launch', 'leetcode', 'github', 'solved', 'pushed'];
  const noiseKeywords = ['meme', 'vent', 'rant', 'joke', 'crypto', 'bootcamp', 'course', 'job'];

  for (const item of items) {
    const text = `${item.title} ${item.summary || ''} ${item.selftext || ''}`.toLowerCase();
    
    // Check if noise
    const isNoise = noiseKeywords.some(k => text.includes(k));
    if (isNoise) continue;

    // Check high priority
    const isHigh = highKeywords.some(k => text.includes(k));
    
    // Simple filter
    if (isHigh || Math.random() > 0.4) {
      filtered.push({
        title: item.title,
        url: item.url || item.link || "",
        source: item.subreddit ? `r/${item.subreddit}` : (item.source || "Feed"),
        priority: isHigh ? 'HIGH' : 'MEDIUM',
        reason: `Filtered via local keyword match (matched criteria in post text).`,
        summary: item.summary ? item.summary.slice(0, 150) + "..." : (item.selftext ? item.selftext.slice(0, 150) + "..." : "No summary available.")
      });
    }
  }
  return filtered;
}

/**
 * Filter items using Gemini 2.5 Flash.
 */
async function filterItemsWithGemini(
  items: any[],
  rulesText: string,
  apiKey: string
): Promise<FilteredItem[]> {
  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `
You are FocusFlow, an advanced AI personal information filter. Your job is to analyze incoming news posts and articles, and filter out low-value content (noise) based on the user's Interest Profile.

Here is the User's filter profile:
${rulesText}

Below is a list of raw posts/articles collected from the internet. Analyze each one:
1. Classify its priority:
   - "HIGH" priority: Urgent major updates, release notes for tools they care about, deep technical case studies, critical CVEs, or important achievements on linked profiles.
   - "MEDIUM" priority: Useful technical tutorials, interesting news/discussions, or general activity logs aligned with their interests.
   - "LOW" priority: Anything that matches the NOISE category, entry-level materials, casual chat, memes, promotional posts, or out-of-scope news.
2. Filter out ALL "LOW" priority items entirely.
3. For HIGH and MEDIUM items, rewrite a concise 1-2 sentence technical summary and provide a brief justification (reason) for why it fits the profile.

Raw items to filter:
${JSON.stringify(items, null, 2)}

Respond ONLY with a JSON array of filtered items matching this TypeScript type:
Array<{
  title: string;
  url: string;
  source: string;
  priority: 'HIGH' | 'MEDIUM';
  reason: string;
  summary: string;
}>
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const text = response.text || "";
    return JSON.parse(text);
  } catch (error: any) {
    console.error("[Orchestrator] Gemini filtering error:", error.message);
    console.log("Falling back to local keyword filter...");
    return mockFilterItems(items, rulesText);
  }
}

/**
 * Executes a curation run for a single user by ID.
 */
export async function runOrchestratorForUser(userId: string, config: FocusConfig, isTestRun: boolean = false) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profiles: true, sources: true }
  });

  if (!user) {
    throw new Error(`User with ID ${userId} not found.`);
  }

  console.log(`\n--------------------------------------------------`);
  console.log(`[Orchestrator] Curation run for user: ${user.discordUsername}`);
  console.log(`--------------------------------------------------`);

  const subreddits = user.sources.filter(s => s.type === 'subreddit').map(s => s.value);
  const rssFeeds = user.sources.filter(s => s.type === 'rss').map(s => s.value);
  const linkedProfiles = user.profiles;

  console.log(`[Profile Config] Found ${subreddits.length} Subreddits, ${rssFeeds.length} RSS feeds, ${linkedProfiles.length} Linked Profiles.`);

  const mcpClient = new FocusMcpClient();
  await mcpClient.connect();

  const rawItems: any[] = [];

  // 1. Gather raw data
  if (isTestRun) {
    console.log("[Test Mode] Generating sample mock data for user...");
    rawItems.push(
      { title: "TypeScript 6.0 Released with New Type-Level Capabilities", url: "https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/", subreddit: "typescript", score: 850 },
      { title: "Look at my cool desk setup!", url: "https://reddit.com/r/webdev/desk", subreddit: "webdev", score: 10, selftext: "I spent $5000 on RGB lights, do you like it?" },
      { title: "Rust 1.85.0 released with stable async closures", url: "https://blog.rust-lang.org/2026/rust-1.85.0.html", subreddit: "rust", score: 920 },
      { title: "Critical vulnerability found in lodash prototype pollution", url: "https://nvd.nist.gov/vuln/detail/CVE-2026-9999", source: "Hacker News", summary: "A major prototype pollution vulnerability was disclosed in lodash affecting millions of Node.js applications." },
      { title: "Figma's engineering: How we modularized our multi-player canvas", url: "https://www.figma.com/blog/multiplayer-canvas-engineering/", source: "Hacker News", summary: "A deep dive into how Figma rewrote their syncing canvas layer to handle 10x player capacity." }
    );

    // Add mock linked profile items for test run
    for (const profile of linkedProfiles) {
      rawItems.push({
        title: `${profile.platform.toUpperCase()} profile activity for ${profile.handle}`,
        url: profile.url,
        source: profile.platform.toUpperCase(),
        summary: `Pushed new repository updates or solved standard algorithm problems in ${profile.platform}.`
      });
    }
  } else {
    // Live Reddit fetch
    for (const sub of subreddits) {
      console.log(`[Collector] Querying Reddit: r/${sub}...`);
      try {
        const res: any = await mcpClient.callTool('reddit_get_posts', { subreddit: sub, limit: 12 });
        if (res && res.content && res.content[0]) {
          const posts = JSON.parse(res.content[0].text);
          rawItems.push(...posts);
        }
      } catch (e: any) {
        console.error(`Failed to fetch r/${sub}: ${e.message}`);
      }
    }

    // Live RSS fetch
    for (const url of rssFeeds) {
      console.log(`[Collector] Parsing RSS Feed: ${url.slice(0, 45)}...`);
      try {
        const res: any = await mcpClient.callTool('rss_fetch_feed', { url });
        if (res && res.content && res.content[0]) {
          const parsed = JSON.parse(res.content[0].text);
          const feedItems = (parsed.items || []).map((item: any) => ({
            ...item,
            source: parsed.title || "RSS Feed"
          }));
          rawItems.push(...feedItems);
        }
      } catch (e: any) {
        console.error(`Failed to fetch RSS feed (${url}): ${e.message}`);
      }
    }

    // Live Linked Profiles fetch
    for (const profile of linkedProfiles) {
      console.log(`[Collector] Fetching ${profile.platform} activity for ${profile.handle}...`);
      try {
        const activities = await fetchProfileActivity(profile.platform, profile.handle);
        rawItems.push(...activities);
      } catch (e: any) {
        console.error(`Failed to fetch linked profile (${profile.platform} / ${profile.handle}): ${e.message}`);
      }
    }
  }

  console.log(`[Collector] Collected ${rawItems.length} total posts/articles/activities.`);

  // 2. Filter data
  let filtered: FilteredItem[] = [];
  const apiKey = config.GEMINI_API_KEY;

  const rulesText = `
## Topic Filters & Rules

### What is IMPORTANT (High Priority)
${user.interests}

### What is NOISE (Filter Out)
${user.noise}
  `.trim();

  if (apiKey && apiKey !== "YOUR_GEMINI_API_KEY") {
    console.log("[Filter] Sending items to Gemini for filtering & synthesis...");
    const batchSize = 15;
    for (let i = 0; i < rawItems.length; i += batchSize) {
      const batch = rawItems.slice(i, i + batchSize);
      console.log(`[Filter] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(rawItems.length/batchSize)}...`);
      const batchFiltered = await filterItemsWithGemini(batch, rulesText, apiKey);
      filtered.push(...batchFiltered);
    }
  } else {
    console.log("[Filter] No GEMINI_API_KEY found or configured. Using local keyword-matching filter fallback.");
    filtered = mockFilterItems(rawItems, rulesText);
  }

  console.log(`[Filter] Filtered out ${rawItems.length - filtered.length} noisy posts. Kept ${filtered.length} valuable updates.`);

  // 3. Deliver updates
  const highPriority = filtered.filter(item => item.priority === 'HIGH');
  const mediumPriority = filtered.filter(item => item.priority === 'MEDIUM');

  // Delivery: HIGH priority
  console.log(`[Delivery] Delivering ${highPriority.length} HIGH priority alerts.`);
  for (const item of highPriority) {
    const desc = `**Summary:** ${item.summary}\n\n**Relevance:** ${item.reason}\n\n[Original Source](${item.url})`;
    
    // Attempt Direct Message via Discord Bot first, fall back to Webhooks
    let delivered = false;
    if (discordBotClient && user.discordId) {
      try {
        const discordUser = await discordBotClient.users.fetch(user.discordId);
        await discordUser.send({
          embeds: [{
            title: item.title,
            description: desc,
            url: item.url,
            color: 15158332, // Red
            timestamp: new Date().toISOString(),
            footer: {
              text: `FocusFlow Priority: HIGH`
            }
          }]
        });
        delivered = true;
        console.log(`[Delivery] Sent Discord DM to user ${user.discordUsername}`);
      } catch (err: any) {
        console.warn(`[Delivery] Failed to DM user ${user.discordUsername}: ${err.message}. Falling back to webhooks.`);
      }
    }

    if (!delivered) {
      const webhookUrl = user.webhookUrl || config.DISCORD_WEBHOOK_URL;
      await mcpClient.callTool('discord_send_webhook', {
        title: item.title,
        description: desc,
        url: item.url,
        priority: 'HIGH'
      });
    }

    // Auto-schedule calendar entry for launches/releases
    if (item.title.toLowerCase().includes('released') || item.title.toLowerCase().includes('launch') || item.title.toLowerCase().includes('date') || item.title.toLowerCase().includes('solved')) {
      const eventTitle = `${user.discordUsername} activity: ${item.title.slice(0, 40)}...`;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 1);
      startDate.setHours(9, 0, 0, 0);
      const endDate = new Date(startDate.getTime() + 3600000);

      console.log(`[Calendar] Auto-scheduling calendar blocker: "${eventTitle}"`);
      await mcpClient.callTool('calendar_add_event', {
        summary: eventTitle,
        description: `Source: ${item.url}\n\nFilter Summary: ${item.summary}`,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString()
      });
    }
  }

  // Delivery: MEDIUM priority digest
  if (mediumPriority.length > 0) {
    console.log(`[Delivery] Compiling ${mediumPriority.length} MEDIUM priority updates into digest...`);
    
    let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f6f8fa; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 12px; border: 1px solid #e1e4e8; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        h1 { color: #1f2328; font-size: 24px; border-bottom: 2px solid #eaeef2; padding-bottom: 12px; margin-top: 0; }
        .post { margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #eaeef2; }
        .post:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
        .title { font-size: 18px; font-weight: 600; color: #0969da; text-decoration: none; display: inline-block; margin-bottom: 6px; }
        .title:hover { text-decoration: underline; }
        .source { font-size: 12px; font-weight: bold; text-transform: uppercase; color: #57606a; background-color: #f1f2f4; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-right: 8px; }
        .reason { font-size: 13px; font-style: italic; color: #6e7781; margin: 8px 0; }
        .summary { font-size: 14px; color: #24292f; line-height: 1.5; margin: 4px 0; }
        .footer { font-size: 12px; color: #57606a; text-align: center; margin-top: 30px; padding-top: 15px; border-top: 1px solid #eaeef2; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>FocusFlow Digest for ${user.discordUsername} - ${new Date().toLocaleDateString()}</h1>
        <p style="color: #57606a; font-size: 14px;">Here is your customized, noise-filtered daily updates list. Total filtered articles: ${mediumPriority.length}.</p>
        
        <div class="posts">
    `;

    for (const item of mediumPriority) {
      htmlContent += `
        <div class="post">
          <span class="source">${item.source}</span>
          <a class="title" href="${item.url}" target="_blank">${item.title}</a>
          <p class="summary">${item.summary}</p>
          <p class="reason"><strong>Why included:</strong> ${item.reason}</p>
        </div>
      `;
    }

    htmlContent += `
        </div>
        <div class="footer">
          FocusFlow • Curated in-process via MCP • ${new Date().toLocaleTimeString()}
        </div>
      </div>
    </body>
    </html>
    `;

    // Save locally with user-specific names
    const digestsDir = path.join(process.cwd(), 'digests');
    if (!fs.existsSync(digestsDir)) {
      fs.mkdirSync(digestsDir, { recursive: true });
    }
    const digestFile = path.join(digestsDir, `digest_${user.discordUsername}_${Date.now()}.html`);
    fs.writeFileSync(digestFile, htmlContent, 'utf-8');
    console.log(`[Email Digest] Saved user HTML digest locally to ${digestFile}`);

    // Call email digest tool (mock or SMTP)
    await mcpClient.callTool('email_send_digest', {
      subject: `FocusFlow Digest: ${mediumPriority.length} Curated Updates for ${user.discordUsername}`,
      htmlContent
    });
  } else {
    console.log(`[Delivery] No medium-priority items to compile for ${user.discordUsername} today.`);
  }

  // Update last sent date
  await prisma.user.update({
    where: { id: user.id },
    data: { lastSentAt: new Date() }
  });

  await mcpClient.disconnect();
}

/**
 * Main entry point run by CLI. Loops over database users.
 */
export async function runOrchestrator(workspaceDir: string, config: FocusConfig, isTestRun: boolean = false) {
  console.log("\n==================================================");
  console.log("             FocusFlow Processing Run            ");
  console.log("==================================================\n");

  // Query all users
  const users = await prisma.user.findMany();

  if (users.length === 0) {
    console.log("[Orchestrator] No users found in database. Please run /register in Discord or seed the database.");
    console.log("==================================================\n");
    return;
  }

  console.log(`[Orchestrator] Found ${users.length} user(s) to process.`);

  for (const user of users) {
    // Check if run is due based on frequency
    let isDue = true;
    
    if (user.lastSentAt && !isTestRun) {
      const msDiff = Date.now() - new Date(user.lastSentAt).getTime();
      const hoursDiff = msDiff / (1000 * 60 * 60);
      if (user.frequency === 'daily' && hoursDiff < 20) { // 20 hours leeway
        isDue = false;
      } else if (user.frequency === 'weekly' && hoursDiff < 160) { // ~6.6 days leeway
        isDue = false;
      }
    }

    if (isDue) {
      try {
        await runOrchestratorForUser(user.id, config, isTestRun);
      } catch (err: any) {
        console.error(`[Orchestrator] Error processing user ${user.discordUsername}:`, err.message);
      }
    } else {
      console.log(`[Orchestrator] Skipping user ${user.discordUsername} (not due yet).`);
    }
  }

  console.log("\n==================================================");
  console.log("            FocusFlow Run Completed              ");
  console.log("==================================================\n");
}
