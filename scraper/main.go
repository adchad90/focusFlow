package main

import (
	"context"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/redis/go-redis/v9"
)

type Post struct {
	Source    string `json:"source"`
	Author    string `json:"author"`
	Text      string `json:"text"`
	URL       string `json:"url"`
	Timestamp int64  `json:"timestamp"`
}

// Reddit JSON structure helper
type RedditResponse struct {
	Data struct {
		Children []struct {
			Data struct {
				Title     string  `json:"title"`
				Author    string  `json:"author"`
				SelfText  string  `json:"selftext"`
				URL       string  `json:"url"`
				CreatedUT float64 `json:"created_utc"`
				Subreddit string  `json:"subreddit"`
			} `json:"data"`
		} `json:"children"`
	} `json:"data"`
}

// RSS XML structures for fallback scraping
type RSSItem struct {
	Title       string `xml:"title"`
	Link        string `xml:"link"`
	Description string `xml:"description"`
	Creator     string `xml:"creator"`
	PubDate     string `xml:"pubDate"`
}

type RSSChannel struct {
	Title string    `xml:"title"`
	Items []RSSItem `xml:"item"`
}

type RSSFeed struct {
	XMLName xml.Name   `xml:"rss"`
	Channel RSSChannel `xml:"channel"`
}

func publishPost(ctx context.Context, rdb *redis.Client, p Post) error {
	data, err := json.Marshal(p)
	if err != nil {
		return err
	}
	return rdb.XAdd(ctx, &redis.XAddArgs{
		Stream: "posts:incoming",
		Values: map[string]interface{}{"post": data},
	}).Err()
}

func fetchRSSPosts(feedURL string) ([]Post, error) {
	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest("GET", feedURL, nil)
	if err != nil {
		return nil, err
	}
	// Reddit RSS feeds check for a browser-like User-Agent
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code for RSS: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var feed RSSFeed
	if err := xml.Unmarshal(body, &feed); err != nil {
		return nil, err
	}

	var posts []Post
	for _, item := range feed.Channel.Items {
		text := item.Title
		if item.Description != "" {
			text = fmt.Sprintf("%s\n\n%s", item.Title, item.Description)
		}
		if len(text) > 1000 {
			text = text[:1000] + "..."
		}

		author := item.Creator
		if author == "" {
			author = "Unknown"
		}

		posts = append(posts, Post{
			Source:    feed.Channel.Title,
			Author:    author,
			Text:      text,
			URL:       item.Link,
			Timestamp: time.Now().Unix(),
		})
	}

	return posts, nil
}

func main() {
	ctx := context.Background()
	rdb := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})

	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Printf("Warning: Failed to connect to Redis on localhost:6379: %v. Make sure Redis is running.", err)
	} else {
		log.Println("Connected to Redis successfully.")
	}

	rssFeeds := []string{
		"https://news.ycombinator.com/rss", // Hacker News
		"https://hnrss.org/show",           // Show HN
		"https://www.reddit.com/r/typescript/.rss", // Reddit TypeScript
		"https://www.reddit.com/r/rust/.rss",       // Reddit Rust
		"https://www.reddit.com/r/golang/.rss",     // Reddit Go
	}

	for {
		log.Println("Starting scraping cycle...")

		// Fetch all RSS feeds (including Reddit and Hacker News)
		for _, feedURL := range rssFeeds {
			log.Printf("Fetching RSS posts from %s...", feedURL)
			posts, err := fetchRSSPosts(feedURL)
			if err != nil {
				log.Printf("RSS error (%s): %v", feedURL, err)
				continue
			}

			log.Printf("Found %d items in feed. Publishing to Redis stream...", len(posts))
			publishedCount := 0
			for _, post := range posts {
				if err := publishPost(ctx, rdb, post); err != nil {
					log.Printf("Error publishing post: %v", err)
				} else {
					publishedCount++
				}
			}
			log.Printf("Successfully published %d/%d posts from RSS feed (%s)", publishedCount, len(posts), feedURL)
		}

		log.Println("Scraping cycle completed. Sleeping for 15 minutes...")
		time.Sleep(15 * time.Minute)
	}
}
