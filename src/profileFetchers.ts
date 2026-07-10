import axios from 'axios';

interface ProfileActivity {
  title: string;
  url: string;
  summary: string;
  timestamp: string;
  source: string;
}

/**
 * Fetches recent public activity from a user's GitHub profile.
 */
export async function fetchGitHubActivity(username: string): Promise<ProfileActivity[]> {
  try {
    const url = `https://api.github.com/users/${username}/events/public?per_page=5`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'FocusFlow/1.0.0 (contact: focusflow-agent@example.com)'
      }
    });

    const events = response.data || [];
    return events.map((event: any) => {
      let action = 'Activity';
      let details = '';

      switch (event.type) {
        case 'PushEvent':
          action = 'Pushed commits';
          details = `to repo ${event.repo.name}. Commits: ${event.payload.commits?.map((c: any) => c.message).join(', ') || ''}`;
          break;
        case 'IssuesEvent':
          action = `${event.payload.action} an issue`;
          details = `in repo ${event.repo.name}: "${event.payload.issue?.title || ''}"`;
          break;
        case 'PullRequestEvent':
          action = `${event.payload.action} a pull request`;
          details = `in repo ${event.repo.name}: "${event.payload.pull_request?.title || ''}"`;
          break;
        case 'CreateEvent':
          action = `Created a ${event.payload.ref_type}`;
          details = `in repo ${event.repo.name} (${event.payload.ref || ''})`;
          break;
        case 'WatchEvent':
          action = `Starred repository`;
          details = `${event.repo.name}`;
          break;
        default:
          action = event.type.replace('Event', '');
          details = `in repository ${event.repo.name}`;
      }

      return {
        title: `GitHub: ${action}`,
        url: `https://github.com/${event.repo.name}`,
        summary: details.slice(0, 500),
        timestamp: event.created_at,
        source: 'GitHub'
      };
    });
  } catch (error: any) {
    console.warn(`[Profile Fetcher] Failed to fetch GitHub activity for ${username}: ${error.message}`);
    return [];
  }
}

/**
 * Fetches recent submissions from a user's LeetCode profile using their GraphQL endpoint.
 */
export async function fetchLeetCodeActivity(username: string): Promise<ProfileActivity[]> {
  try {
    const url = 'https://leetcode.com/graphql';
    const query = `
      query userRecentSubmissions($username: String!, $limit: Int!) {
        recentSubmissionList(username: $username, limit: $limit) {
          title
          titleSlug
          timestamp
          statusDisplay
          lang
        }
      }
    `;

    const response = await axios.post(url, {
      query,
      variables: {
        username,
        limit: 5
      }
    }, {
      headers: {
        'User-Agent': 'FocusFlow/1.0.0 (contact: focusflow-agent@example.com)',
        'Content-Type': 'application/json'
      }
    });

    const submissions = response.data?.data?.recentSubmissionList || [];
    return submissions.map((sub: any) => ({
      title: `LeetCode: Solved "${sub.title}"`,
      url: `https://leetcode.com/problems/${sub.titleSlug}/`,
      summary: `Result: ${sub.statusDisplay} (Language: ${sub.lang})`,
      timestamp: new Date(Number(sub.timestamp) * 1000).toISOString(),
      source: 'LeetCode'
    }));
  } catch (error: any) {
    console.warn(`[Profile Fetcher] Failed to fetch LeetCode activity for ${username}: ${error.message}`);
    return [];
  }
}

/**
 * Mock/Stub fetcher for platforms that require heavy scraping/auth (Twitter, LinkedIn).
 */
export async function fetchMockSocialActivity(platform: string, username: string): Promise<ProfileActivity[]> {
  const mockActivities: Record<string, ProfileActivity[]> = {
    twitter: [
      {
        title: `Twitter: Post by @${username}`,
        url: `https://twitter.com/${username}/status/123456`,
        summary: "Excited to share that we just launched our new open-source agent framework powered by MCP! Check it out: https://github.com/example/agent-mcp",
        timestamp: new Date().toISOString(),
        source: 'Twitter'
      },
      {
        title: `Twitter: Retweet by @${username}`,
        url: `https://twitter.com/${username}/status/123457`,
        summary: "TypeScript 6.0 promises some unbelievable type system speedups. Can't wait for the beta compiler notes to release tomorrow.",
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
        source: 'Twitter'
      }
    ],
    linkedin: [
      {
        title: `LinkedIn: Post by ${username}`,
        url: `https://linkedin.com/in/${username}`,
        summary: "I'm happy to share my thoughts on systems architecture and why modular codebases save engineering teams time. In this post, I detail how Figma rewrote their multi-player engine...",
        timestamp: new Date(Date.now() - 3600000 * 12).toISOString(),
        source: 'LinkedIn'
      }
    ]
  };

  return mockActivities[platform.toLowerCase()] || [];
}

/**
 * Master fetcher for any linked profile.
 */
export async function fetchProfileActivity(platform: string, username: string): Promise<ProfileActivity[]> {
  const plat = platform.toLowerCase();
  if (plat === 'github') {
    return fetchGitHubActivity(username);
  } else if (plat === 'leetcode') {
    return fetchLeetCodeActivity(username);
  } else {
    return fetchMockSocialActivity(platform, username);
  }
}
