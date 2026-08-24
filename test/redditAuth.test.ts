jest.mock('obsidian', () => ({ requestUrl: jest.fn() }));

import { requestUrl } from 'obsidian';
import { RedditAuth, RedditAuthError } from '../src/lib/reddit-auth';

const mockRequest = requestUrl as unknown as jest.Mock;
const settings = { clientId: 'id', clientSecret: 'secret', topComments: 10 };

beforeEach(() => mockRequest.mockReset());

describe('RedditAuth', () => {
    it('throws a setup error when creds are missing', async () => {
        const auth = new RedditAuth(() => ({ ...settings, clientId: '' }));
        await expect(auth.getToken()).rejects.toThrow(RedditAuthError);
        expect(mockRequest).not.toHaveBeenCalled();
    });

    it('fetches and caches a token', async () => {
        mockRequest.mockResolvedValue({ status: 200, json: { access_token: 'tok', expires_in: 3600 } });
        const auth = new RedditAuth(() => settings);
        expect(await auth.getToken()).toBe('tok');
        expect(await auth.getToken()).toBe('tok');
        expect(mockRequest).toHaveBeenCalledTimes(1);
        const call = mockRequest.mock.calls[0][0];
        expect(call.url).toBe('https://www.reddit.com/api/v1/access_token');
        expect(call.headers.Authorization).toBe('Basic ' + btoa('id:secret'));
        expect(call.body).toBe('grant_type=client_credentials');
    });

    it('refreshes after invalidate()', async () => {
        mockRequest.mockResolvedValue({ status: 200, json: { access_token: 'tok', expires_in: 3600 } });
        const auth = new RedditAuth(() => settings);
        await auth.getToken();
        auth.invalidate();
        await auth.getToken();
        expect(mockRequest).toHaveBeenCalledTimes(2);
    });

    it('refreshes once the cached token nears expiry', async () => {
        mockRequest.mockResolvedValue({ status: 200, json: { access_token: 'tok', expires_in: 30 } });
        const auth = new RedditAuth(() => settings);
        await auth.getToken();
        await auth.getToken();
        expect(mockRequest).toHaveBeenCalledTimes(2);
    });

    it('surfaces rejection as RedditAuthError', async () => {
        mockRequest.mockResolvedValue({ status: 401, json: {} });
        const auth = new RedditAuth(() => settings);
        await expect(auth.getToken()).rejects.toThrow(/rejected the credentials/);
    });
});
