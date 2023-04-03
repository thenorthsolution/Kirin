import { Collection } from 'discord.js';

export async function resolveFromCachedManager<V>(id: string, manager: { cache: Collection<string, V>; fetch(key: string): Promise<V|null> }): Promise<V> {
    const data = manager.cache.get(id) ?? await manager.fetch(id);
    if (data === null) throw new Error(`Couldn't fetch (${id}) from manager`);
    return data;
}
