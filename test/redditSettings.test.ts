jest.mock('obsidian', () => ({ moment: jest.requireActual('moment') }));

import { DEFAULT_SETTINGS } from '../src/const';

describe('reddit settings defaults', () => {
    it('defaults to 10 top comments', () => {
        expect(DEFAULT_SETTINGS.reddit).toEqual({ topComments: 10 });
    });
});
