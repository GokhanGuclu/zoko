import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, Guild, GuildMember, ChannelType, TextChannel, Role, PermissionFlagsBits, Collection } from 'discord.js';
import { getPool } from './db';

export type ModalField = {
	id: string;
	custom_id: string;
	label: string;
	style: 'short' | 'paragraph';
	required: boolean;
	placeholder?: string | null;
	min_length?: number | null;
	max_length?: number | null;
	order: number;
};

export async function getRegistrationSettings(guildId: string): Promise<{ channelId?: string; reviewChannelId?: string; allowedRoleIds: string[]; registeredRoleId?: string; newMemberRoleId?: string } | null> {
	const pool = getPool();
	if (!pool) return null;
	const result = await pool.execute(
		'SELECT register_channel_id, review_channel_id, allowed_role_ids, registered_role_id, new_member_role_id FROM registration_settings WHERE guild_id = ? LIMIT 1',
		[guildId]
	);
	const [rows] = result as unknown as [any[]];
	if (!rows.length) return { channelId: undefined, reviewChannelId: undefined, allowedRoleIds: [], registeredRoleId: undefined };
	const channelId = rows[0].register_channel_id ?? undefined;
	const reviewChannelId = rows[0].review_channel_id ?? undefined;
	const allowedRoleIds = (rows[0].allowed_role_ids as string | null)?.split(',').filter(Boolean) ?? [];
	const registeredRoleId = rows[0].registered_role_id ?? undefined;
	const newMemberRoleId = rows[0].new_member_role_id ?? undefined;
	return { channelId, reviewChannelId, allowedRoleIds, registeredRoleId, newMemberRoleId };
}

export async function setRegistrationChannel(guildId: string, channelId: string): Promise<void> {
	const pool = getPool();
	if (!pool) return;
	await pool.execute(
		'INSERT INTO registration_settings (guild_id, register_channel_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE register_channel_id = VALUES(register_channel_id)',
		[guildId, channelId]
	);
}

export async function setReviewChannel(guildId: string, channelId: string): Promise<void> {
	const pool = getPool();
	if (!pool) return;
	await pool.execute(
		'INSERT INTO registration_settings (guild_id, review_channel_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE review_channel_id = VALUES(review_channel_id)',
		[guildId, channelId]
	);
}

export async function setAllowedRoles(guildId: string, roleIds: string[]): Promise<void> {
	const pool = getPool();
	if (!pool) return;
	await pool.execute(
		'INSERT INTO registration_settings (guild_id, allowed_role_ids) VALUES (?, ?) ON DUPLICATE KEY UPDATE allowed_role_ids = VALUES(allowed_role_ids)',
		[guildId, roleIds.join(',')]
	);
}

export async function setRegisteredRole(guildId: string, roleId: string): Promise<void> {
	const pool = getPool();
	if (!pool) return;
	await pool.execute(
		'INSERT INTO registration_settings (guild_id, registered_role_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE registered_role_id = VALUES(registered_role_id)',
		[guildId, roleId]
	);
}

export async function setNewMemberRole(guildId: string, roleId: string): Promise<void> {
	const pool = getPool();
	if (!pool) return;
	await pool.execute(
		'INSERT INTO registration_settings (guild_id, new_member_role_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE new_member_role_id = VALUES(new_member_role_id)',
		[guildId, roleId]
	);
}

export async function saveSubmission(guildId: string, userId: string, payload: Record<string, string>): Promise<string> {
    const pool = getPool();
    if (!pool) throw new Error('DB not configured');
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    await pool.execute(
        'INSERT INTO registration_submissions (id, guild_id, user_id, payload, status) VALUES (?, ?, ?, ?, ?)',
        [id, guildId, userId, JSON.stringify(payload), 'pending']
    );
    return id;
}

export type Submission = {
    id: string;
    guild_id: string;
    user_id: string;
    payload: Record<string, string>;
    status: 'pending' | 'approved' | 'rejected';
    approved_by?: string | null;
    rejected_by?: string | null;
    reject_reason?: string | null;
    created_at: string;
};

export async function getSubmission(guildId: string, submissionId: string): Promise<Submission | null> {
    const pool = getPool();
    if (!pool) return null;
    const result = await pool.execute(
        `SELECT id, guild_id, user_id, payload, status, approved_by, rejected_by, reject_reason, created_at
         FROM registration_submissions WHERE guild_id = ? AND id = ? LIMIT 1`,
        [guildId, submissionId]
    );
    const [rows] = result as unknown as [any[]];
    if (!rows.length) return null;
    const r = rows[0];
    return {
        id: r.id,
        guild_id: r.guild_id,
        user_id: r.user_id,
        payload: JSON.parse(r.payload),
        status: r.status,
        approved_by: r.approved_by,
        rejected_by: r.rejected_by,
        reject_reason: r.reject_reason,
        created_at: r.created_at,
    };
}

export async function approveSubmission(guildId: string, submissionId: string, approverUserId: string): Promise<boolean> {
    const pool = getPool();
    if (!pool) return false;
    const [res] = (await pool.execute(
        `UPDATE registration_submissions SET status = 'approved', approved_by = ?, updated_at = CURRENT_TIMESTAMP
         WHERE guild_id = ? AND id = ? AND status = 'pending'`,
        [approverUserId, guildId, submissionId]
    )) as unknown as [any];
    return (res as any).affectedRows > 0;
}

export async function rejectSubmission(guildId: string, submissionId: string, rejectorUserId: string, reason: string | null = null): Promise<boolean> {
    const pool = getPool();
    if (!pool) return false;
    const [res] = (await pool.execute(
        `UPDATE registration_submissions SET status = 'rejected', rejected_by = ?, reject_reason = ?, updated_at = CURRENT_TIMESTAMP
         WHERE guild_id = ? AND id = ? AND status = 'pending'`,
        [rejectorUserId, reason, guildId, submissionId]
    )) as unknown as [any];
    return (res as any).affectedRows > 0;
}

export async function listModalFields(guildId: string): Promise<ModalField[]> {
	const pool = getPool();
	if (!pool) return [];
	const result = await pool.execute(
		'SELECT id, custom_id, label, style, required, placeholder, min_length, max_length, sort_order FROM registration_modal_fields WHERE guild_id = ? ORDER BY sort_order ASC, created_at ASC',
		[guildId]
	);
	const [rows] = result as unknown as [any[]];
	return rows.map((r: any) => ({
		id: r.id,
		custom_id: r.custom_id,
		label: r.label,
		style: r.style,
		required: !!r.required,
		placeholder: r.placeholder,
		min_length: r.min_length,
		max_length: r.max_length,
		order: r.sort_order,
	}));
}

export async function addModalField(guildId: string, field: Omit<ModalField, 'id'>): Promise<ModalField> {
	const pool = getPool();
	if (!pool) throw new Error('DB not configured');
	const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
	await pool.execute(
		'INSERT INTO registration_modal_fields (id, guild_id, custom_id, label, style, required, placeholder, min_length, max_length, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
		[id, guildId, field.custom_id, field.label, field.style, field.required ? 1 : 0, field.placeholder ?? null, field.min_length ?? null, field.max_length ?? null, field.order]
	);
	return { id, ...field };
}

export async function deleteModalField(guildId: string, fieldId: string): Promise<boolean> {
	const pool = getPool();
	if (!pool) return false;
	const result = await pool.execute(
		'DELETE FROM registration_modal_fields WHERE guild_id = ? AND id = ? LIMIT 1',
		[guildId, fieldId]
	);
	const [res] = result as unknown as [any];
	return (res as any).affectedRows > 0;
}

export async function buildRegistrationModal(guildId: string): Promise<ModalBuilder | null> {
	const fields = await listModalFields(guildId);
	if (fields.length === 0) return null;
	const modal = new ModalBuilder().setCustomId('reg:submit').setTitle('Kayıt Formu');
	const rows: ActionRowBuilder<TextInputBuilder>[] = [];
	for (const f of fields.slice(0, 5)) {
		const input = new TextInputBuilder()
			.setCustomId(f.custom_id)
			.setLabel(f.label)
			.setStyle(f.style === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
			.setRequired(f.required);
		if (f.placeholder) input.setPlaceholder(f.placeholder);
		if (typeof f.min_length === 'number') input.setMinLength(f.min_length);
		if (typeof f.max_length === 'number') input.setMaxLength(f.max_length);
		rows.push(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
	}
	modal.addComponents(...rows);
	return modal;
}

export async function updateModalField(
    guildId: string,
    fieldId: string,
    updates: Partial<{
        label: string;
        style: 'short' | 'paragraph';
        required: boolean;
        placeholder: string | null;
        min_length: number | null;
        max_length: number | null;
        order: number;
    }>
): Promise<boolean> {
    const pool = getPool();
    if (!pool) return false;
    const fields: string[] = [];
    const values: any[] = [];
    if (updates.label !== undefined) { fields.push('label = ?'); values.push(updates.label); }
    if (updates.style !== undefined) { fields.push('style = ?'); values.push(updates.style); }
    if (updates.required !== undefined) { fields.push('required = ?'); values.push(updates.required ? 1 : 0); }
    if (updates.placeholder !== undefined) { fields.push('placeholder = ?'); values.push(updates.placeholder); }
    if (updates.min_length !== undefined) { fields.push('min_length = ?'); values.push(updates.min_length); }
    if (updates.max_length !== undefined) { fields.push('max_length = ?'); values.push(updates.max_length); }
    if (updates.order !== undefined) { fields.push('sort_order = ?'); values.push(updates.order); }
    if (!fields.length) return false;
    values.push(guildId, fieldId);
    const [res] = (await pool.execute(
        `UPDATE registration_modal_fields SET ${fields.join(', ')} WHERE guild_id = ? AND id = ?`,
        values
    )) as unknown as [any];
    return (res as any).affectedRows > 0;
}


