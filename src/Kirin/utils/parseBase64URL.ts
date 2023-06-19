export function parseBase64URL(url: string): Buffer {
    const [data, base64] = url.split(',');

    const [mime, type] = (data.split(':')[1]?.split(';') ?? []).filter(Boolean);
    if (type.toLowerCase() !== 'base64') throw new Error('URL is not a valid base64');

    return Buffer.from(base64, 'base64');
}
