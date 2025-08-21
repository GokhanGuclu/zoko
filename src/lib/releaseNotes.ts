import { getPool } from './db';

export type ReleaseNote = {
    id: string;
    guildId: string | null;
    version: string;
    title: string | null;
    body: string;
    createdBy: string | null;
    createdAt?: Date;
};

type ReleaseNoteRow = {
    id: string;
    guild_id: string | null;
    version: string;
    title: string | null;
    body: string;
    created_by: string | null;
    created_at: string;
};

const memoryStore = new Map<string, ReleaseNote[]>(); // key: guildId or GLOBAL

function getCacheKey(guildId?: string | null): string {
    return guildId || 'GLOBAL';
}

export async function addReleaseNote(params: {
    version: string;
    body: string;
    title?: string | null;
    guildId?: string | null;
    createdBy?: string | null;
}): Promise<ReleaseNote> {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const note: ReleaseNote = {
        id,
        version: params.version,
        body: params.body,
        title: params.title ?? null,
        guildId: params.guildId ?? null,
        createdBy: params.createdBy ?? null,
    };
    const pool = getPool();
    if (pool) {
        await pool.execute(
            'INSERT INTO release_notes (id, guild_id, version, title, body, created_by) VALUES (?, ?, ?, ?, ?, ?)',
            [id, note.guildId, note.version, note.title, note.body, note.createdBy]
        );
    }
    const key = getCacheKey(note.guildId ?? undefined);
    const list = memoryStore.get(key) ?? [];
    list.push({ ...note, createdAt: new Date() });
    // En yeni başa gelsin
    list.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
    memoryStore.set(key, list);
    return note;
}

export async function getLatestReleaseNote(guildId?: string | null): Promise<ReleaseNote | null> {
    const pool = getPool();
    if (pool) {
        const [rows] = (await pool.execute(
            `SELECT id, guild_id, version, title, body, created_by, created_at
             FROM release_notes
             WHERE ${guildId ? 'guild_id = ?' : 'guild_id IS NULL'}
             ORDER BY created_at DESC
             LIMIT 1`,
            guildId ? [guildId] : []
        )) as unknown as [ReleaseNoteRow[]];
        if (rows.length) {
            const r = rows[0];
            return {
                id: r.id,
                guildId: r.guild_id,
                version: r.version,
                title: r.title,
                body: r.body,
                createdBy: r.created_by,
                createdAt: new Date(r.created_at),
            };
        }
        // Global’e düş
        if (guildId) return getLatestReleaseNote(null);
        return null;
    }
    const key = getCacheKey(guildId);
    const list = memoryStore.get(key) ?? [];
    if (list.length) return list[0];
    if (guildId) return getLatestReleaseNote(null);
    return null;
}

export async function getReleaseNoteByVersion(version: string, guildId?: string | null): Promise<ReleaseNote | null> {
    const pool = getPool();
    if (pool) {
        const [rows] = (await pool.execute(
            `SELECT id, guild_id, version, title, body, created_by, created_at
             FROM release_notes
             WHERE version = ? AND ${guildId ? 'guild_id = ?' : 'guild_id IS NULL'}
             LIMIT 1`,
            guildId ? [version, guildId] : [version]
        )) as unknown as [ReleaseNoteRow[]];
        if (rows.length) {
            const r = rows[0];
            return {
                id: r.id,
                guildId: r.guild_id,
                version: r.version,
                title: r.title,
                body: r.body,
                createdBy: r.created_by,
                createdAt: new Date(r.created_at),
            };
        }
        if (guildId) return getReleaseNoteByVersion(version, null);
        return null;
    }
    const key = getCacheKey(guildId);
    const list = memoryStore.get(key) ?? [];
    const found = list.find((n) => n.version === version) || (guildId ? (memoryStore.get(getCacheKey(null)) || []).find((n) => n.version === version) : undefined);
    return found ?? null;
}

export async function listReleaseNotes(limit = 10, guildId?: string | null): Promise<ReleaseNote[]> {
    const pool = getPool();
    if (pool) {
        const [rows] = (await pool.execute(
            `SELECT id, guild_id, version, title, body, created_by, created_at
             FROM release_notes
             WHERE ${guildId ? 'guild_id = ?' : 'guild_id IS NULL'}
             ORDER BY created_at DESC
             LIMIT ?`,
            guildId ? [guildId, limit] : [limit]
        )) as unknown as [ReleaseNoteRow[]];
        return rows.map((r) => ({
            id: r.id,
            guildId: r.guild_id,
            version: r.version,
            title: r.title,
            body: r.body,
            createdBy: r.created_by,
            createdAt: new Date(r.created_at),
        }));
    }
    const key = getCacheKey(guildId);
    return (memoryStore.get(key) ?? []).slice(0, limit);
}


