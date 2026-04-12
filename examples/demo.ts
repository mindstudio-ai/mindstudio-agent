import { mindstudio } from '@mindstudio-ai/agent';

const { content } = await mindstudio.scrapeUrl({
  url: 'https://news.ycombinator.com/',
  service: 'default',
  autoEnhance: false,
  outputFormat: 'text',
  pageOptions: {
    onlyMainContent: true,
    screenshot: false,
    waitFor: 0,
    replaceAllPathsWithAbsolutePaths: false,
    headers: {},
    removeTags: [],
    mobile: false,
  },
});

console.log(content);
