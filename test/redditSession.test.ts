jest.mock('obsidian', () => ({ requestUrl: jest.fn() }));

import { requestUrl } from 'obsidian';
import { RedditSession } from '../src/lib/reddit-session';

const mockRequest = requestUrl as unknown as jest.Mock;

beforeEach(() => mockRequest.mockReset());

describe('RedditSession', () => {
    it('extracts the loid cookie from a lowercase set-cookie header', async () => {
        mockRequest.mockResolvedValue({
            status: 200,
            headers: { 'set-cookie': 'loid=abc123; Path=/; Secure' },
            text: '',
        });
        const session = new RedditSession();
        expect(await session.getCookieHeader()).toBe('loid=abc123');
    });

    it('matches the header name case-insensitively', async () => {
        mockRequest.mockResolvedValue({
            status: 200,
            headers: { 'Set-Cookie': 'loid=xyz789; Path=/' },
            text: '',
        });
        const session = new RedditSession();
        expect(await session.getCookieHeader()).toBe('loid=xyz789');
    });

    it('caches a successful cookie across calls', async () => {
        mockRequest.mockResolvedValue({
            status: 200,
            headers: { 'set-cookie': 'loid=abc123; Path=/' },
            text: '',
        });
        const session = new RedditSession();
        await session.getCookieHeader();
        await session.getCookieHeader();
        expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    it('returns undefined without throwing when no loid cookie is present', async () => {
        mockRequest.mockResolvedValue({ status: 200, headers: {}, text: '' });
        const session = new RedditSession();
        expect(await session.getCookieHeader()).toBeUndefined();
    });

    it('returns undefined without throwing when the priming request itself fails', async () => {
        mockRequest.mockRejectedValue(new Error('network down'));
        const session = new RedditSession();
        await expect(session.getCookieHeader()).resolves.toBeUndefined();
    });

    it('retries priming on the next call after a failed attempt', async () => {
        mockRequest
            .mockResolvedValueOnce({ status: 503, headers: {}, text: '' })
            .mockResolvedValueOnce({ status: 200, headers: { 'set-cookie': 'loid=abc123; Path=/' }, text: '' });
        const session = new RedditSession();
        expect(await session.getCookieHeader()).toBeUndefined();
        expect(await session.getCookieHeader()).toBe('loid=abc123');
        expect(mockRequest).toHaveBeenCalledTimes(2);
    });
});
