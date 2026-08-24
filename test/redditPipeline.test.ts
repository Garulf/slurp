import * as parse from '../src/parse';
import { slurpPipeline } from '../src/pipeline';
import type { IArticle, ISlurpPipelineOptions } from '../src/types';

jest.mock('../src/parse');

const DEFAULT_TAG_SETTINGS = { parse: true, prefix: '', case: 'kebab-case' as const };

const HANDLER_ARTICLE: IArticle = {
    title: 'Handled',
    content: '<p>from handler</p>',
    link: 'https://www.reddit.com/r/x/comments/abc123/handled/',
    slurpedTime: new Date(),
    tags: [],
};

const baseOptions = (overrides: Partial<ISlurpPipelineOptions> = {}): ISlurpPipelineOptions => ({
    fmProps: new Map(),
    tagSettings: DEFAULT_TAG_SETTINGS,
    frontmatterOnly: false,
    processors: { document: [], article: [], markdown: [] },
    ...overrides,
});

beforeEach(() => {
    jest.clearAllMocks();
    (parse.fetchHtml as jest.Mock).mockResolvedValue('<html></html>');
    (parse.parseHtml as jest.Mock).mockReturnValue({} as Document);
    (parse.parsePage as jest.Mock).mockReturnValue({ title: 'Fetched', content: '<p>fetched</p>' });
    (parse.parseMetadata as jest.Mock).mockReturnValue({ slurpedTime: new Date(), tags: [] });
    (parse.mergeMetadata as jest.Mock).mockImplementation(
        (article: IArticle, metadata: IArticle) => ({ ...article, ...metadata })
    );
    (parse.parseMarkdown as jest.Mock).mockImplementation((html: string) => `md:${html}`);
});

describe('slurpPipeline site handlers', () => {
    it('uses the handler article and skips fetching entirely', async () => {
        const resolve = jest.fn().mockResolvedValue({ ...HANDLER_ARTICLE });
        const result = await slurpPipeline('https://www.reddit.com/r/x/comments/abc123/', baseOptions({
            handlers: [{ matches: () => true, resolve }],
        }));

        expect(resolve).toHaveBeenCalledWith('https://www.reddit.com/r/x/comments/abc123/');
        expect(parse.fetchHtml).not.toHaveBeenCalled();
        expect(parse.parsePage).not.toHaveBeenCalled();
        expect(parse.parseMetadata).not.toHaveBeenCalled();
        expect(result.title).toBe('Handled');
        expect(result.content).toBe('md:<p>from handler</p>');
    });

    it('keeps the handler article link instead of the input url', async () => {
        const result = await slurpPipeline('https://redd.it/abc123', baseOptions({
            handlers: [{ matches: () => true, resolve: jest.fn().mockResolvedValue({ ...HANDLER_ARTICLE }) }],
        }));
        expect(result.link).toBe(HANDLER_ARTICLE.link);
    });

    it('falls back to the input url when the article has no link', async () => {
        const article = { ...HANDLER_ARTICLE };
        delete (article as Partial<IArticle>).link;
        const result = await slurpPipeline('https://redd.it/abc123', baseOptions({
            handlers: [{ matches: () => true, resolve: jest.fn().mockResolvedValue(article) }],
        }));
        expect(result.link).toBe('https://redd.it/abc123');
    });

    it('ignores handlers that do not match', async () => {
        const resolve = jest.fn();
        const result = await slurpPipeline('https://example.com/article', baseOptions({
            handlers: [{ matches: () => false, resolve }],
        }));
        expect(resolve).not.toHaveBeenCalled();
        expect(parse.fetchHtml).toHaveBeenCalledWith('https://example.com/article');
        expect(result.title).toBe('Fetched');
    });

    it('behaves as before when no handlers are provided', async () => {
        const result = await slurpPipeline('https://example.com/article', baseOptions());
        expect(parse.fetchHtml).toHaveBeenCalled();
        expect(result.title).toBe('Fetched');
    });

    it('frontmatterOnly returns empty content but full handler metadata', async () => {
        const result = await slurpPipeline('https://redd.it/abc123', baseOptions({
            frontmatterOnly: true,
            handlers: [{ matches: () => true, resolve: jest.fn().mockResolvedValue({ ...HANDLER_ARTICLE }) }],
        }));
        expect(result.content).toBe('');
        expect(result.title).toBe('Handled');
        expect(parse.parseMarkdown).not.toHaveBeenCalled();
    });
});
