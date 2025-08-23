import { ApplicationCommandType, ContextMenuCommandBuilder, GuildMember, UserContextMenuCommandInteraction, User } from 'discord.js';
import { buildEmbed, formatFooter } from '../lib/ui';

function buildSizeLinks(url: string | null): string {
	if (!url) return '—';
	const sizes = [128, 256, 512, 1024, 2048, 4096];
	const base = url.split('?')[0];
	return sizes.map((s) => `[${s}](${base}?size=${s})`).join(' | ');
}

async function resolveMemberSafe(interaction: UserContextMenuCommandInteraction, user: User): Promise<GuildMember | null> {
	if (!interaction.guild) return null;
	try { return await interaction.guild.members.fetch(user.id); } catch { return null; }
}

const data = new ContextMenuCommandBuilder()
	.setName('Avatar')
	.setType(ApplicationCommandType.User)
	.setDMPermission(true);

async function execute(interaction: UserContextMenuCommandInteraction): Promise<void> {
	const user = interaction.targetUser as User;
	const member = await resolveMemberSafe(interaction, user);

	const userName = member?.nickname || user.globalName || user.username;
	const avatarURL = user.displayAvatarURL({ size: 2048 });
	const serverAvatarURL = member?.avatar ? member.displayAvatarURL({ size: 2048 }) : null;

	const fields = [
		{ name: 'Kullanıcı', value: `${userName} (${user.id})`, inline: false },
		{ name: 'Avatar Boyutları', value: buildSizeLinks(avatarURL), inline: false },
	];
	if (serverAvatarURL) {
		fields.push({ name: 'Sunucu Avatarı Boyutları', value: buildSizeLinks(serverAvatarURL), inline: false });
	}

	const embed = buildEmbed({
		title: 'Avatar',
		description: member && interaction.guild ? `Sunucu: ${interaction.guild.name}` : undefined,
		fields,
		thumbnailUrl: avatarURL,
		imageUrl: serverAvatarURL ?? avatarURL,
		footerText: formatFooter(interaction.guild ? interaction.guild.name : 'Doğrudan Mesaj'),
		timestamp: true,
	});

	await interaction.reply({ embeds: [embed], ephemeral: true, allowedMentions: { parse: [] } });
}

export default { data, execute };


