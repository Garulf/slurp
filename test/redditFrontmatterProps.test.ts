jest.mock('obsidian', () => ({ moment: jest.requireActual('moment') }));

import { FRONT_MATTER_ITEM_DEFAULTS } from '../src/const';
import { createFrontMatterProps } from '../src/frontmatter';

describe('reddit frontmatter defaults', () => {
    it.each(['subreddit', 'score', 'commentCount', 'flair'])('defines %s', (id) => {
        expect(FRONT_MATTER_ITEM_DEFAULTS.get(id)).toBeDefined();
    });

    it('uses "comments" as the key for commentCount', () => {
        expect(FRONT_MATTER_ITEM_DEFAULTS.get('commentCount')?.defaultKey).toBe('comments');
    });

    it('appears even when saved settings predate the fork', () => {
        const props = createFrontMatterProps({
            link: { id: 'link', custom: false, enabled: true },
        });
        expect(props.get('subreddit')).toBeDefined();
        expect(props.get('subreddit')?.enabled).toBe(true);
    });
});
