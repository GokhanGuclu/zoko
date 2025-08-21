import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder, User } from 'discord.js';
import { buildEmbed, formatFooter } from '../lib/ui';

function buildSizeLinks(url: string | null): string {
	if (!url) return '—';
	const sizes = [128, 256, 512, 1024, 2048, 4096];
	const base = url.split('?')[0];
	return sizes.map((s) => `[${s}](${base}?size=${s})`).join(' | ');
}

async function resolveUser(interaction: ChatInputCommandInteraction): Promise<{ user: User; member: GuildMember | null }>
{
	const target = interaction.options.getUser('kisi') ?? interaction.user;
	let fetched = target;
	try { fetched = await target.fetch(true); } catch {}
	const member = interaction.guild ? await interaction.guild.members.fetch(target.id).catch(() => null) : null;
	return { user: fetched, member };
}

const data = new SlashCommandBuilder()
	.setName('avatar')
	.setDescription('Bir kullanıcının avatarını yüksek çözünürlükte gösterir')
	.setDMPermission(true)
	.addUserOption((opt) => opt.setName('kisi').setDescription('Avatarı görüntülenecek kişi').setRequired(false))
	.addBooleanOption((opt) => opt.setName('gizli').setDescription('Yanıt sadece size görünsün (ephemeral)').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	const { user, member } = await resolveUser(interaction);
	const ephemeral = interaction.options.getBoolean('gizli') ?? false;

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
		description: member && member.id !== interaction.user.id && interaction.guild ? `Sunucu: ${interaction.guild.name}` : undefined,
		fields,
		thumbnailUrl: avatarURL,
		imageUrl: serverAvatarURL ?? avatarURL,
		footerText: formatFooter(interaction.guild ? interaction.guild.name : 'Doğrudan Mesaj'),
		timestamp: true,
	});

	await interaction.reply({ embeds: [embed], ephemeral, allowedMentions: { parse: [] } });
}

export default { data, execute };


