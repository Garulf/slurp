import { buildRedditArticle } from '../src/handlers/reddit-article';

/* eslint-disable @typescript-eslint/no-explicit-any -- fixtures mirror reddit's loosely typed json */

const makePost = (overrides: Record<string, unknown> = {}) => ({
    title: 'A post title',
    author: 'someuser',
    subreddit: 'ObsidianMD',
    permalink: '/r/ObsidianMD/comments/1g4g2xu/a_post_title/',
    created_utc: 1724457600,
    score: 42,
    num_comments: 7,
    is_self: true,
    is_video: false,
    selftext: 'hello world',
    selftext_html: '<p>hello world</p>',
    url: 'https://www.reddit.com/r/ObsidianMD/comments/1g4g2xu/a_post_title/',
    link_flair_text: null,
    ...overrides,
});

const makeComment = (overrides: Record<string, unknown> = {}): any => ({
    kind: 't1',
    data: {
        author: 'commenter',
        body: 'nice post',
        body_html: '<p>nice post</p>',
        score: 5,
        created_utc: 1724461200,
        stickied: false,
        replies: '',
        ...overrides,
    },
});

const makeListing = (post: Record<string, unknown>, comments: unknown[] = []) => ([
    { kind: 'Listing', data: { children: [{ kind: 't3', data: post }] } },
    { kind: 'Listing', data: { children: comments } },
]);

describe('buildRedditArticle bodies', () => {
    it('uses selftext_html for self posts', () => {
        const article = buildRedditArticle(makeListing(makePost()), 0);
        expect(article.content).toContain('<p>hello world</p>');
        expect(article.title).toBe('A post title');
    });

    it('emits an img for image posts', () => {
        const article = buildRedditArticle(makeListing(makePost({
            is_self: false, selftext: '', selftext_html: null,
            post_hint: 'image', url: 'https://i.redd.it/abc.jpg',
        })), 0);
        expect(article.content).toContain('<img src="https://i.redd.it/abc.jpg">');
    });

    it('renders galleries in gallery_data order', () => {
        const article = buildRedditArticle(makeListing(makePost({
            is_self: false, selftext: '', selftext_html: null, is_gallery: true,
            gallery_data: { items: [{ media_id: 'b' }, { media_id: 'a' }] },
            media_metadata: {
                a: { s: { u: 'https://i.redd.it/a.jpg' } },
                b: { s: { u: 'https://i.redd.it/b.jpg' } },
            },
        })), 0);
        const first = article.content.indexOf('b.jpg');
        const second = article.content.indexOf('a.jpg');
        expect(first).toBeGreaterThan(-1);
        expect(second).toBeGreaterThan(first);
    });

    it('embeds the reddit player for video posts', () => {
        const article = buildRedditArticle(makeListing(makePost({
            is_self: false, selftext: '', selftext_html: null,
            is_video: true, media: { reddit_video: { fallback_url: 'https://v.redd.it/x/DASH_720.mp4' } },
        })), 0);
        expect(article.content).toContain(
            'https://embed.reddit.com/r/ObsidianMD/comments/1g4g2xu/a_post_title/?embed=true&ref_source=embed');
        expect(article.content).toContain('Watch on Reddit');
        expect(article.type).toBe('video');
    });

    it('links out for link posts', () => {
        const article = buildRedditArticle(makeListing(makePost({
            is_self: false, selftext: '', selftext_html: null, url: 'https://example.com/story',
        })), 0);
        expect(article.content).toContain('<a href="https://example.com/story">https://example.com/story</a>');
        expect(article.type).toBe('link');
    });

    it('appends selftext after media when both exist', () => {
        const article = buildRedditArticle(makeListing(makePost({
            is_self: false, post_hint: 'image', url: 'https://i.redd.it/abc.jpg',
            selftext: 'caption', selftext_html: '<p>caption</p>',
        })), 0);
        expect(article.content.indexOf('abc.jpg')).toBeLessThan(article.content.indexOf('caption'));
    });

    it('prefixes crossposts with the origin', () => {
        const article = buildRedditArticle(makeListing(makePost({
            is_self: false, selftext: '', selftext_html: null,
            crosspost_parent_list: [{
                subreddit: 'origsub', permalink: '/r/origsub/comments/zzz/orig/',
                is_self: true, selftext: 'original', selftext_html: '<p>original</p>',
                url: 'https://www.reddit.com/r/origsub/comments/zzz/orig/',
            }],
        })), 0);
        expect(article.content).toContain('Crossposted from');
        expect(article.content).toContain('/r/origsub/comments/zzz/orig/');
        expect(article.content).toContain('<p>original</p>');
    });
});

describe('buildRedditArticle comments', () => {
    it('limits to topComments and skips stickied and deleted', () => {
        const comments = [
            makeComment({ stickied: true, author: 'AutoModerator' }),
            makeComment({ author: 'a' }),
            makeComment({ author: '[deleted]', body: '[deleted]', body_html: '<p>[deleted]</p>' }),
            makeComment({ author: 'b' }),
            makeComment({ author: 'c' }),
        ];
        const article = buildRedditArticle(makeListing(makePost(), comments), 2);
        expect(article.content).toContain('<h2>Comments</h2>');
        expect(article.content).toContain('u/a');
        expect(article.content).toContain('u/b');
        expect(article.content).not.toContain('u/c');
        expect(article.content).not.toContain('AutoModerator');
        expect(article.content).not.toContain('[deleted]');
    });

    it('nests replies and skips more stubs', () => {
        const child = makeComment({ author: 'childuser', body_html: '<p>reply</p>' });
        const parent = makeComment({
            author: 'parentuser',
            replies: { kind: 'Listing', data: { children: [child, { kind: 'more', data: {} }] } },
        });
        const article = buildRedditArticle(makeListing(makePost(), [parent]), 5);
        expect(article.content).toContain('u/parentuser');
        expect(article.content).toContain('u/childuser');
        const parentIdx = article.content.indexOf('u/parentuser');
        expect(article.content.indexOf('u/childuser')).toBeGreaterThan(parentIdx);
    });

    it('omits the comments section when topComments is 0', () => {
        const article = buildRedditArticle(makeListing(makePost(), [makeComment()]), 0);
        expect(article.content).not.toContain('<h2>Comments</h2>');
    });
});

describe('buildRedditArticle metadata', () => {
    it('maps post fields onto slurp properties', () => {
        const article = buildRedditArticle(makeListing(makePost({ link_flair_text: 'Discussion' })), 0);
        expect(article.byline).toBe('u/someuser');
        expect(article.siteName).toBe('r/ObsidianMD');
        expect(article.subreddit).toBe('r/ObsidianMD');
        expect(article.score).toBe(42);
        expect(article.commentCount).toBe(7);
        expect(article.flair).toBe('Discussion');
        expect(article.type).toBe('post');
        expect(article.link).toBe('https://www.reddit.com/r/ObsidianMD/comments/1g4g2xu/a_post_title/');
        expect(article.publishedTime).toBe(1724457600 * 1000);
        expect(article.excerpt).toBe('hello world');
        expect(article.tags).toEqual([{ prefix: '', tag: 'ObsidianMD' }]);
        expect(article.slurpedTime).toBeInstanceOf(Date);
    });
});
