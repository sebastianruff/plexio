export const parseUrlToIpPort = (url: string): string => {
  const urlObj = new URL(url);
  const { hostname, port, protocol } = urlObj;

  const hyphenatedIpPattern = /^\d+-\d+-\d+-\d+$/;
  const normalizedHost = hyphenatedIpPattern.test(hostname)
    ? hostname.replace(/-/g, '.')
    : hostname;

  const resolvedPort =
    port || (protocol === 'https:' ? '443' : protocol === 'http:' ? '80' : '');

  return resolvedPort ? `${normalizedHost}:${resolvedPort}` : normalizedHost;
};
