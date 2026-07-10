import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with test user...');

  // Clean existing tables
  await prisma.profile.deleteMany({});
  await prisma.source.deleteMany({});
  await prisma.user.deleteMany({});

  // Create a default test user
  const user = await prisma.user.create({
    data: {
      discordUsername: 'test_discord_user',
      discordId: '123456789012345678', // Sample discord snowflake ID
      webhookUrl: 'YOUR_DISCORD_WEBHOOK_URL', // Overwritten by config if set
      frequency: 'daily',
      interests: `
- Announcements of major software versions (e.g. TypeScript 6.0, React 20, Rust 1.85).
- In-depth architectural case studies or post-mortems from reputable engineering teams (e.g. Figma, Netflix, GitHub, Vercel).
- Critical security vulnerabilities (CVEs) affecting widely-used packages.
- Breakthrough AI research, open-source models, or new agent architectures.
      `.trim(),
      noise: `
- Entry-level tutorials (e.g. "How to write a loop", "Intro to HTML/CSS").
- Casual rants, venting, meme posts, and low-effort listicles (e.g. "10 extensions you need").
- Self-promotional bootcamps, paid course advertisements, or general job postings.
- Speculative financial news, cryptocurrency updates, or general political discussions.
- Minor minor-version package updates (e.g., a bugfix patch release of a small library).
      `.trim(),
      sources: {
        create: [
          { type: 'subreddit', value: 'typescript' },
          { type: 'subreddit', value: 'rust' },
          { type: 'subreddit', value: 'webdev' },
          { type: 'rss', value: 'https://news.ycombinator.com/rss' },
          { type: 'rss', value: 'https://dev.to/feed' }
        ]
      },
      profiles: {
        create: [
          { platform: 'github', handle: 'gaearon', url: 'https://github.com/gaearon' },
          { platform: 'leetcode', handle: 'anonymous', url: 'https://leetcode.com/anonymous/' }
        ]
      }
    }
  });

  console.log(`Database seeded successfully! Created user ID: ${user.id}`);
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
