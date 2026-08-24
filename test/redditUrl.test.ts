import { extractCanonicalPostUrl, parseRedditUrl } from '../src/handlers/reddit-url';

describe('parseRedditUrl', () => {
    it.each([
        ['https://www.reddit.com/r/ObsidianMD/comments/1g4g2xu/some_slug/', '1g4g2xu'],
        ['https://old.reddit.com/r/ObsidianMD/comments/1g4g2xu', '1g4g2xu'],
        ['https://redd.it/1g4g2xu', '1g4g2xu'],
        ['http://reddit.com/comments/1g4g2xu', '1g4g2xu'],
        ['https://np.reddit.com/r/foo/comments/AB12cd/', 'ab12cd'],
    ])('parses %s as post', (url, id36) => {
        expect(parseRedditUrl(url)).toEqual({ kind: 'post', id36 });
    });

    it('recognizes mobile share links', () => {
        const url = 'https://www.reddit.com/r/ObsidianMD/s/AbCdEf123';
        expect(parseRedditUrl(url)).toEqual({ kind: 'share', url });
    });

    it.each([
        'https://www.reddit.com/r/ObsidianMD/',
        'https://www.reddit.com/user/spez/',
        'https://v.redd.it/abc123',
    ])('flags %s unsupported', (url) => {
        expect(parseRedditUrl(url).kind).toBe('unsupported');
    });

    it.each(['https://example.com/r/fake/comments/123', 'not a url'])(
        'passes %s through as not-reddit', (url) => {
            expect(parseRedditUrl(url).kind).toBe('not-reddit');
        });
});

describe('extractCanonicalPostUrl', () => {
    it('reads og:url', () => {
        const html = '<head><meta property="og:url" content="https://www.reddit.com/r/x/comments/abc123/t/"/></head>';
        expect(extractCanonicalPostUrl(html)).toBe('https://www.reddit.com/r/x/comments/abc123/t/');
    });

    it('reads og:url with attributes reversed', () => {
        const html = '<meta content="https://www.reddit.com/r/x/comments/abc123/t/" property="og:url">';
        expect(extractCanonicalPostUrl(html)).toBe('https://www.reddit.com/r/x/comments/abc123/t/');
    });

    it('falls back to rel=canonical', () => {
        const html = '<link rel="canonical" href="https://www.reddit.com/r/x/comments/abc123/t/">';
        expect(extractCanonicalPostUrl(html)).toBe('https://www.reddit.com/r/x/comments/abc123/t/');
    });

    it('returns null when absent', () => {
        expect(extractCanonicalPostUrl('<html><title>Blocked</title></html>')).toBeNull();
    });
});
