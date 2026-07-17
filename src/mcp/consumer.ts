import { Redis } from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { GoogleGenAI } from '@google/genai';
import { discordBotClient } from '../discord/bot.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const STREAM_NAME = 'posts:incoming';
const CONSUMER_GROUP = 'ts-consumers';
const CONSUMER_NAME = 'consumer-node-1';

interface StreamPost {
  source: string;
  author: string;
  text: string;
  url: string;
  timestamp: number;
}

/**
 * Initializes the Redis consumer group if it doesn't already exist.
 */
export async function initConsumerGroup() {
  try {
    // Create group reading from '0' (start of stream) so no backlog is skipped
    await redis.xgroup('CREATE', STREAM_NAME, CONSUMER_GROUP, '0', 'MKSTREAM');
    console.log(`[Consumer] Created Redis Consumer Group "${CONSUMER_GROUP}"`);
  } catch (err: any) {
    if (!err.message.includes('BUSYGROUP')) {
      console.error('[Consumer] Failed to create consumer group:', err.message);
    }
  }
}

/**
 * Process a single post by matching it against all user profiles.
 */
async function processPostForUsers(ai: GoogleGenAI, post: StreamPost, users: any[]) {
  // If there are no users, nothing to do
  if (users.length === 0) return;

  const userProfilesJson = users.map(u => ({
    userId: u.id,
    discordUsername: u.discordUsername,
    interests: u.interests,
    noise: u.noise
  }));

  const prompt = `
You are FocusFlow, an advanced AI personal information filter.
Below is an incoming post. Evaluate it against the user profiles provided.

Post details:
- Source: ${post.source}
- Author: ${post.author}
- Content: ${post.text}
- Link: ${post.url}

User Profiles:
${JSON.stringify(userProfilesJson, null, 2)}

For each user, decide if this post is highly relevant to their interests (NOT matching their noise rules).
Only return a match if the content is high-value for their interests.

Respond ONLY with a JSON array listing matching user IDs and a concise 1-sentence reason why it is relevant. Do not include markdown code fence formatting.
Example output format:
[
  { "userId": "user-uuid-1", "reason": "Mentions typescript 6.0 release notes which aligns with their interest in typescript compiler updates" }
]
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const textResponse = response.text?.trim() || '[]';
    const matches: { userId: string; reason: string }[] = JSON.parse(textResponse);

    for (const match of matches) {
      const user = users.find(u => u.id === match.userId);
      if (!user) continue;

      console.log(`[Consumer] Post matched user ${user.discordUsername}. Reason: ${match.reason}`);

      // 1. Create curation record in database so user can rate it
      let curationId = '';
      try {
        const dbCuration = await prisma.curation.create({
          data: {
            userId: user.id,
            title: post.text.split('\n')[0].slice(0, 100), // Get first line or title
            url: post.url,
            source: post.source,
            summary: post.text,
            priority: 'HIGH'
          }
        });
        curationId = dbCuration.id;
      } catch (dbErr: any) {
        console.error(`[Consumer] Failed to write curation record: ${dbErr.message}`);
      }

      // 2. Route via Discord DM if possible
      if (discordBotClient && user.discordId) {
        try {
          const discordUser = await discordBotClient.users.fetch(user.discordId);

          // Configure curation thumbs rating buttons
          const thumbsUpButton = new ButtonBuilder()
            .setCustomId(`rate_curation_10:${curationId}`)
            .setLabel('👍 Useful')
            .setStyle(ButtonStyle.Success);

          const thumbsDownButton = new ButtonBuilder()
            .setCustomId(`rate_curation_0:${curationId}`)
            .setLabel('👎 Noise')
            .setStyle(ButtonStyle.Danger);

          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(thumbsUpButton, thumbsDownButton);

          await discordUser.send({
            embeds: [{
              title: `FocusFlow: New Post from ${post.source}`,
              description: `**Content:** ${post.text}\n\n**Relevance:** ${match.reason}\n\n[Original Post](${post.url})`,
              url: post.url,
              color: 3447003, // Blue
              timestamp: new Date().toISOString(),
              footer: {
                text: `Author: ${post.author}`
              }
            }],
            components: curationId ? [row] : []
          });

          console.log(`[Consumer] Successfully sent Discord DM notification to ${user.discordUsername}`);
        } catch (discordErr: any) {
          console.error(`[Consumer] Failed to send Discord DM: ${discordErr.message}`);
        }
      }
    }
  } catch (error: any) {
    console.error('[Consumer] Gemini evaluation error:', error.message);
  }
}

/**
 * Main worker loop for the Redis Stream consumer.
 */
export async function startConsumer(apiKey: string) {
  await initConsumerGroup();
  const ai = new GoogleGenAI({ apiKey });

  console.log('[Consumer] Redis stream consumer starting loop...');

  while (true) {
    try {
      // Fetch new messages from the stream
      const result = await redis.xreadgroup(
        'GROUP', CONSUMER_GROUP, CONSUMER_NAME,
        'COUNT', '5',
        'BLOCK', '2000',
        'STREAMS', STREAM_NAME, '>'
      );

      if (!result) {
        continue;
      }

      const resultTyped = result as any;
      const [_streamName, messages] = resultTyped[0];
      const users = await prisma.user.findMany();

      for (const [msgId, fields] of messages) {
        // Find the 'post' field key
        let postJson = '';
        for (let i = 0; i < fields.length; i += 2) {
          if (fields[i] === 'post') {
            postJson = fields[i + 1];
            break;
          }
        }

        if (!postJson) {
          console.warn(`[Consumer] Missing 'post' field in stream message ${msgId}`);
          await redis.xack(STREAM_NAME, CONSUMER_GROUP, msgId);
          continue;
        }

        try {
          const post: StreamPost = JSON.parse(postJson);
          // Evaluate match
          await processPostForUsers(ai, post, users);
          // Acknowledge receipt
          await redis.xack(STREAM_NAME, CONSUMER_GROUP, msgId);
        } catch (jsonErr: any) {
          console.error(`[Consumer] JSON parse error on message ${msgId}:`, jsonErr.message);
          // Ack bad JSON to avoid blocking the queue
          await redis.xack(STREAM_NAME, CONSUMER_GROUP, msgId);
        }
      }
    } catch (loopErr: any) {
      console.error('[Consumer] Consumer loop error:', loopErr.message);
      // Wait briefly on error to avoid hot looping
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}
