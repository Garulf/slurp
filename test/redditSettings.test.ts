jest.mock('obsidian', () => ({ moment: jest.requireActual('moment') }));

import { DEFAULT_SETTINGS } from '../src/const';

describe('reddit settings defaults', () => {
    it('has empty creds and 10 top comments by default', () => {
        expect(DEFAULT_SETTINGS.reddit).toEqual({ clientId: "", clientSecret: "", topComments: 10 });
    });
});
