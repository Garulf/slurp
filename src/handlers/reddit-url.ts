const REDDIT_HOSTS = new Set(["reddit.com", "www.reddit.com", "old.reddit.com", "np.reddit.com", "new.reddit.com"]);
const POST_PATH = /^(?:\/r\/[^/]+)?\/comments\/([a-z0-9]+)/i;
const SHARE_PATH = /^\/r\/[^/]+\/s\/[^/]+/i;
const SHORTLINK_PATH = /^\/([a-z0-9]+)\/?$/i;

export type RedditUrl =
    | { kind: "post"; id36: string }
    | { kind: "share"; url: string }
    | { kind: "unsupported" }
    | { kind: "not-reddit" };

export const parseRedditUrl = (url: string): RedditUrl => {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return { kind: "not-reddit" };
    }
    const host = parsed.hostname.toLowerCase();

    if (REDDIT_HOSTS.has(host)) {
        const post = POST_PATH.exec(parsed.pathname);
        if (post) return { kind: "post", id36: post[1].toLowerCase() };
        if (SHARE_PATH.test(parsed.pathname)) return { kind: "share", url };
        return { kind: "unsupported" };
    }
    if (host === "redd.it") {
        const short = SHORTLINK_PATH.exec(parsed.pathname);
        if (short) return { kind: "post", id36: short[1].toLowerCase() };
        return { kind: "unsupported" };
    }
    if (host.endsWith(".redd.it")) return { kind: "unsupported" };
    return { kind: "not-reddit" };
};

export const extractCanonicalPostUrl = (html: string): string | null => {
    const og = /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i.exec(html)
        ?? /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:url["']/i.exec(html);
    if (og) return og[1];
    const canonical = /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i.exec(html);
    return canonical ? canonical[1] : null;
};
