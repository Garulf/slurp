import { requestUrl } from "obsidian";
import { logger } from "./logger";

export const REDDIT_BROWSER_USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const LOID_SOURCE_URL = "https://old.reddit.com/";
const LOID_PATTERN = /loid=([^;]+)/;

const findHeader = (headers: Record<string, string>, name: string): string | undefined => {
    const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
    return key ? headers[key] : undefined;
};

export class RedditSession {
    private loidCookie: string | null = null;

    async getCookieHeader(): Promise<string | undefined> {
        if (!this.loidCookie) await this.prime();
        return this.loidCookie ? `loid=${this.loidCookie}` : undefined;
    }

    private async prime(): Promise<void> {
        try {
            const response = await requestUrl({
                url: LOID_SOURCE_URL,
                headers: { "User-Agent": REDDIT_BROWSER_USER_AGENT },
                throw: false,
            });
            const setCookie = findHeader(response.headers ?? {}, "set-cookie");
            const match = setCookie ? LOID_PATTERN.exec(setCookie) : null;
            if (match) this.loidCookie = match[1];
        } catch (err) {
            logger().debug("reddit session priming failed", { err: (err as Error).message });
        }
    }
}
