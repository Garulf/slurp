jest.mock('obsidian', () => ({ requestUrl: jest.fn() }));

import { requestUrl } from 'obsidian';
import { RedditHandler } from '../src/handlers/reddit';

const mockRequest = requestUrl as unknown as jest.Mock;
const settings = { topComments: 10 };

const postUrl = 'https://www.reddit.com/r/ObsidianMD/comments/1g4g2xu/a_post_title/';
const shareUrl = 'https://www.reddit.com/r/ObsidianMD/s/AbCdEf123';

const listing = [
    {
        kind: 'Listing', data: {
            children: [{
                kind: 't3', data: {
                    title: 'A post title', author: 'someuser', subreddit: 'ObsidianMD',
                    permalink: '/r/ObsidianMD/comments/1g4g2xu/a_post_title/',
                    created_utc: 1724457600, score: 42, num_comments: 7,
                    is_self: true, is_video: false,
                    selftext: 'hello', selftext_html: '<p>hello</p>',
                    url: postUrl, link_flair_text: null,
                }
            }]
        }
    },
    { kind: 'Listing', data: { children: [] } },
];

beforeEach(() => mockRequest.mockReset());

const handler = () => new RedditHandler(() => settings);

const dispatchByUrl = (jsonResponse: { status: number; json?: unknown; text?: string }) => {
    mockRequest.mockImplementation((opts: { url: string }) => {
        if (opts.url === 'https://old.reddit.com/')
            return Promise.resolve({ status: 200, headers: { 'set-cookie': 'loid=abc123; Path=/' }, text: '' });
        return Promise.resolve(jsonResponse);
    });
};

describe('RedditHandler.matches', () => {
    it.each([postUrl, shareUrl, 'https://www.reddit.com/r/ObsidianMD/'])('claims %s', (url) => {
        expect(handler().matches(url)).toBe(true);
    });

    it('declines non-reddit urls', () => {
        expect(handler().matches('https://example.com/article')).toBe(false);
    });
});

describe('RedditHandler.resolve', () => {
    it('fetches the post anonymously and returns the article', async () => {
        dispatchByUrl({ status: 200, json: listing });
        const article = await handler().resolve(postUrl);
        expect(article.title).toBe('A post title');
        const apiCall = mockRequest.mock.calls.find(
            ([opts]) => (opts as { url: string }).url.startsWith('https://www.reddit.com/comments/1g4g2xu'));
        expect(apiCall).toBeDefined();
        const opts = apiCall![0] as { headers: Record<string, string> };
        expect(opts.headers.Cookie).toBe('loid=abc123');
        expect(opts.headers['User-Agent']).toContain('Mozilla');
    });

    it('proceeds without a cookie if session priming yields none', async () => {
        mockRequest.mockImplementation((opts: { url: string }) => {
            if (opts.url === 'https://old.reddit.com/')
                return Promise.resolve({ status: 200, headers: {}, text: '' });
            return Promise.resolve({ status: 200, json: listing });
        });
        const article = await handler().resolve(postUrl);
        expect(article.title).toBe('A post title');
        const apiCall = mockRequest.mock.calls.find(
            ([opts]) => (opts as { url: string }).url.startsWith('https://www.reddit.com/comments/1g4g2xu'));
        expect((apiCall![0] as { headers: Record<string, string> }).headers.Cookie).toBeUndefined();
    });

    it('reports rate limiting distinctly', async () => {
        dispatchByUrl({ status: 429, json: {} });
        await expect(handler().resolve(postUrl)).rejects.toThrow(/rate limiting/);
    });

    it('reports other API failures with the status', async () => {
        dispatchByUrl({ status: 500, json: {} });
        await expect(handler().resolve(postUrl)).rejects.toThrow(/HTTP 500/);
    });

    it('reports a non-JSON 200 response clearly', async () => {
        mockRequest.mockImplementation((opts: { url: string }) => {
            if (opts.url === 'https://old.reddit.com/')
                return Promise.resolve({ status: 200, headers: {}, text: '' });
            return Promise.resolve({
                status: 200,
                get json(): unknown { throw new SyntaxError('Unexpected token'); },
                text: '<html>not json</html>',
            });
        });
        await expect(handler().resolve(postUrl)).rejects.toThrow(/unexpected \(non-JSON\) response/);
    });

    it('resolves share links via the canonical url', async () => {
        mockRequest.mockImplementation((opts: { url: string }) => {
            if (opts.url === shareUrl) return Promise.resolve({
                status: 200,
                text: `<meta property="og:url" content="${postUrl}"/>`,
            });
            if (opts.url === 'https://old.reddit.com/')
                return Promise.resolve({ status: 200, headers: { 'set-cookie': 'loid=abc123; Path=/' }, text: '' });
            return Promise.resolve({ status: 200, json: listing });
        });
        const article = await handler().resolve(shareUrl);
        expect(article.title).toBe('A post title');
    });

    it('explains when share link resolution is blocked', async () => {
        mockRequest.mockResolvedValue({ status: 200, text: '<html><title>Blocked</title></html>' });
        await expect(handler().resolve(shareUrl)).rejects.toThrow(/share its full URL/);
    });

    it('rejects non-post reddit urls with a clear message', async () => {
        await expect(handler().resolve('https://www.reddit.com/r/ObsidianMD/'))
            .rejects.toThrow(/Only Reddit post links/);
        expect(mockRequest).not.toHaveBeenCalled();
    });
});
