import type { IArticle } from "../types";

/* eslint-disable @typescript-eslint/no-explicit-any -- reddit's json is untyped */

interface RedditComment {
    kind: string;
    data: any;
}

const IMAGE_URL = /\.(png|jpe?g|gif|webp)$/i;

const isImagePost = (post: any): boolean =>
    post.post_hint === "image" || (typeof post.url === "string" && IMAGE_URL.test(post.url));

const galleryHtml = (post: any): string => {
    const items: any[] = post.gallery_data?.items ?? [];
    return items
        .map((item) => {
            const meta = post.media_metadata?.[item.media_id];
            const src = meta?.s?.u ?? meta?.s?.gif;
            return src ? `<img src="${src}">` : "";
        })
        .filter((html) => html !== "")
        .join("\n");
};

const mediaHtml = (post: any): string | null => {
    if (post.crosspost_parent_list?.[0]) {
        const parent = post.crosspost_parent_list[0];
        const origin = `<p>Crossposted from <a href="https://www.reddit.com${parent.permalink}">r/${parent.subreddit}</a></p>`;
        return `${origin}\n${bodyHtml(parent)}`;
    }
    if (post.is_video && post.media?.reddit_video) {
        return `<iframe src="https://embed.reddit.com${post.permalink}?embed=true&ref_source=embed" width="640" height="480" allowfullscreen></iframe>\n` +
            `<p><a href="https://www.reddit.com${post.permalink}">Watch on Reddit</a></p>`;
    }
    if (post.is_gallery) return galleryHtml(post);
    if (isImagePost(post)) return `<img src="${post.url}">`;
    return null;
};

const bodyHtml = (post: any): string => {
    const media = mediaHtml(post);
    const selftext = typeof post.selftext_html === "string" && post.selftext_html !== "" ? post.selftext_html : null;

    if (media && selftext) return `${media}\n${selftext}`;
    if (media) return media;
    if (selftext) return selftext;
    return `<p><a href="${post.url}">${post.url}</a></p>`;
};

const isRenderableComment = (c: RedditComment): boolean =>
    c.kind === "t1"
    && !c.data.stickied
    && c.data.author !== "[deleted]"
    && c.data.body !== "[deleted]"
    && c.data.body !== "[removed]";

const commentHtml = (c: RedditComment): string => {
    const date = new Date(c.data.created_utc * 1000).toISOString();
    const replies: RedditComment[] = typeof c.data.replies === "object" && c.data.replies !== null
        ? c.data.replies.data?.children ?? []
        : [];
    const children = replies
        .filter(isRenderableComment)
        .map(commentHtml)
        .join("\n");
    return `<blockquote><p><strong>u/${c.data.author}</strong> (${c.data.score} points, ${date}):</p>` +
        `${c.data.body_html ?? ""}${children}</blockquote>`;
};

const commentsHtml = (comments: RedditComment[], topComments: number): string => {
    const rendered = comments
        .filter(isRenderableComment)
        .slice(0, topComments)
        .map(commentHtml);
    if (rendered.length === 0) return "";
    return `\n<h2>Comments</h2>\n${rendered.join("\n")}`;
};

const postType = (post: any): string => {
    if (post.is_video) return "video";
    if (post.is_gallery) return "gallery";
    if (isImagePost(post)) return "image";
    if (post.is_self) return "post";
    return "link";
};

export const buildRedditArticle = (listing: unknown, topComments: number): IArticle => {
    const listings = listing as any[];
    const post = listings?.[0]?.data?.children?.[0]?.data;
    if (!post) throw new Error("Reddit returned an unexpected response for this post.");

    const comments: RedditComment[] = listings[1]?.data?.children ?? [];
    const content = topComments > 0
        ? bodyHtml(post) + commentsHtml(comments, topComments)
        : bodyHtml(post);

    return {
        title: post.title,
        content,
        slurpedTime: new Date(),
        tags: [{ prefix: "", tag: post.subreddit }],
        byline: `u/${post.author}`,
        siteName: `r/${post.subreddit}`,
        subreddit: `r/${post.subreddit}`,
        publishedTime: post.created_utc * 1000,
        link: `https://www.reddit.com${post.permalink}`,
        score: post.score,
        commentCount: post.num_comments,
        flair: post.link_flair_text ?? null,
        type: postType(post),
        excerpt: typeof post.selftext === "string" && post.selftext !== ""
            ? post.selftext.slice(0, 200)
            : null,
    };
};
