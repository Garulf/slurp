import { requestUrl } from "obsidian";
import { logger } from "./logger";
import type { IRedditSettings } from "../types";

export const REDDIT_USER_AGENT = "obsidian:slurp-reddit-fork:v1.0 (personal use)";

const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const EXPIRY_MARGIN_MS = 60_000;

export class RedditAuthError extends Error { }

export class RedditAuth {
    private token: string | null = null;
    private expiresAt = 0;

    constructor(private getSettings: () => IRedditSettings) { }

    async getToken(): Promise<string> {
        const { clientId, clientSecret } = this.getSettings();
        if (!clientId || !clientSecret) {
            throw new RedditAuthError(
                'Reddit credentials are not configured. Add a client ID and secret in Slurp settings ' +
                '(create a "script" app at reddit.com/prefs/apps).');
        }

        if (this.token && Date.now() < this.expiresAt) return this.token;

        const response = await requestUrl({
            url: TOKEN_URL,
            method: "POST",
            headers: {
                Authorization: "Basic " + btoa(`${clientId}:${clientSecret}`),
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": REDDIT_USER_AGENT,
            },
            body: "grant_type=client_credentials",
            throw: false,
        });

        const accessToken = response.status === 200 ? response.json?.access_token : undefined;
        if (!accessToken) {
            logger().debug("reddit token request failed", { status: response.status, body: response.text });

            if (response.status === 401 || response.status === 403) {
                throw new RedditAuthError(
                    `Reddit rejected the credentials (HTTP ${response.status}). ` +
                    'Check the client ID and secret in Slurp settings.');
            }
            throw new RedditAuthError(
                `Reddit's token endpoint returned HTTP ${response.status}. ` +
                'This is usually transient; wait a moment and try again.');
        }

        this.token = accessToken;
        const expiresIn = typeof response.json.expires_in === "number" ? response.json.expires_in : 3600;
        this.expiresAt = Date.now() + expiresIn * 1000 - EXPIRY_MARGIN_MS;
        return accessToken;
    }

    invalidate(): void {
        this.token = null;
        this.expiresAt = 0;
    }
}
