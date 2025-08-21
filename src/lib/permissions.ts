import { ChannelType, Guild, PermissionsBitField, TextChannel } from 'discord.js';

export async function applyNewMemberRolePermissions(
	guild: Guild,
	newMemberRoleId: string,
	registerChannelId: string
): Promise<{ updated: number; skipped: number }> {
	let updated = 0;
	let skipped = 0;
	const botUserId = guild.client.user?.id;
	for (const [, ch] of guild.channels.cache) {
		try {
			const isCategory = ch.type === ChannelType.GuildCategory;
			const isRegister = ch.id === registerChannelId;
			// Apply to all channels including categories
			if (isRegister && ch.type === ChannelType.GuildText) {
				const registerChannel = ch as TextChannel;
				const overwrites: any[] = [
					{
						id: guild.roles.everyone.id,
						deny: [
							PermissionsBitField.Flags.ViewChannel,
							PermissionsBitField.Flags.SendMessages,
							PermissionsBitField.Flags.ReadMessageHistory,
						],
					},
					{
						id: newMemberRoleId,
						allow: [
							PermissionsBitField.Flags.ViewChannel,
							PermissionsBitField.Flags.SendMessages,
							PermissionsBitField.Flags.ReadMessageHistory,
						],
					},
				];
				if (botUserId) {
					overwrites.push({
						id: botUserId,
						allow: [
							PermissionsBitField.Flags.ViewChannel,
							PermissionsBitField.Flags.SendMessages,
							PermissionsBitField.Flags.ReadMessageHistory,
						],
					});
				}
				await registerChannel.permissionOverwrites.set(overwrites);
				updated++;
			} else {
				if ('permissionOverwrites' in ch) {
					await (ch as any).permissionOverwrites.edit(newMemberRoleId, {
						ViewChannel: false,
						SendMessages: false,
						ReadMessageHistory: false,
						Connect: false,
						Speak: false,
						SendMessagesInThreads: false,
					});
					updated++;
				} else {
					skipped++;
				}
			}
		} catch {
			skipped++;
		}
	}
	return { updated, skipped };
}

export async function applyReviewChannelPermissions(
	guild: Guild,
	reviewChannelId: string,
	allowedRoleIds: string[]
): Promise<void> {
	const channel = guild.channels.cache.get(reviewChannelId);
	if (!channel || channel.type !== ChannelType.GuildText) return;
	const botUserId = guild.client.user?.id;
	const overwrites: any[] = [
		{
			id: guild.roles.everyone.id,
			deny: [
				PermissionsBitField.Flags.ViewChannel,
				PermissionsBitField.Flags.SendMessages,
				PermissionsBitField.Flags.ReadMessageHistory,
			],
		},
	];
	for (const roleId of allowedRoleIds) {
		overwrites.push({
			id: roleId,
			allow: [
				PermissionsBitField.Flags.ViewChannel,
				PermissionsBitField.Flags.SendMessages,
				PermissionsBitField.Flags.ReadMessageHistory,
			],
		});
	}
	if (botUserId) {
		overwrites.push({
			id: botUserId,
			allow: [
				PermissionsBitField.Flags.ViewChannel,
				PermissionsBitField.Flags.SendMessages,
				PermissionsBitField.Flags.ReadMessageHistory,
			],
		});
	}
	await (channel as TextChannel).permissionOverwrites.set(overwrites);
}


