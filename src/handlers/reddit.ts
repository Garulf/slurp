import { requestUrl } from "obsidian";
import { RedditAuth, REDDIT_USER_AGENT } from "../lib/reddit-auth";
import type { IArticle, IRedditSettings, ISiteHandler } from "../types";
import { buildRedditArticle } from "./reddit-article";
import { extractCanonicalPostUrl, parseRedditUrl } from "./reddit-url";

export class RedditHandler implements ISiteHandler {
    private auth: RedditAuth;

    constructor(private getSettings: () => IRedditSettings) {
        this.auth = new RedditAuth(getSettings);
    }

    matches(url: string): boolean {
        return parseRedditUrl(url).kind !== "not-reddit";
    }

    async resolve(url: string): Promise<IArticle> {
        const id36 = await this.resolvePostId(url);
        const response = await this.fetchListing(id36);
        return buildRedditArticle(response, this.getSettings().topComments);
    }

    private async resolvePostId(url: string): Promise<string> {
        const parsed = parseRedditUrl(url);
        switch (parsed.kind) {
            case "post":
                return parsed.id36;
            case "share":
                return this.resolveShareLink(parsed.url);
            case "unsupported":
                throw new Error("Only Reddit post links can be slurped (not subreddit or user pages).");
            case "not-reddit":
                throw new Error("RedditHandler.resolve called for a non-reddit url");
        }
    }

    private async resolveShareLink(url: string): Promise<string> {
        const response = await requestUrl({
            url,
            headers: { "User-Agent": REDDIT_USER_AGENT },
            throw: false,
        });
        const canonical = response.text ? extractCanonicalPostUrl(response.text) : null;
        const parsed = canonical ? parseRedditUrl(canonical) : null;
        if (parsed?.kind === "post") return parsed.id36;
        throw new Error(
            "Could not resolve this Reddit share link (Reddit blocked the lookup). " +
            "Open the post in a browser and share its full URL instead.");
    }

    private async fetchListing(id36: string, isRetry = false): Promise<unknown> {
        const token = await this.auth.getToken();
        const response = await requestUrl({
            url: `https://oauth.reddit.com/comments/${id36}?raw_json=1&limit=100&sort=top`,
            headers: {
                Authorization: `Bearer ${token}`,
                "User-Agent": REDDIT_USER_AGENT,
            },
            throw: false,
        });

        if (response.status === 401 && !isRetry) {
            this.auth.invalidate();
            return this.fetchListing(id36, true);
        }
        if (response.status === 429)
            throw new Error("Reddit is rate limiting requests. Try again in a minute.");
        if (response.status !== 200 || !Array.isArray(response.json))
            throw new Error(`Reddit API request failed (HTTP ${response.status}).`);

        return response.json;
    }
}
