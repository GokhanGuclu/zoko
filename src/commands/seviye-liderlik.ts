import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { getLevelSettings, getTopUsers } from '../lib/levels';
import { renderLeaderboard } from '../lib/levelImages';

const data = new SlashCommandBuilder()
	.setName('seviye-liderlik')
	.setDescription('Seviye liderlik tablosunu gösterir')
	.setDMPermission(false)
	.addIntegerOption((opt) => opt.setName('sayfa').setDescription('Sayfa numarası (1...)').setRequired(false))
	.addBooleanOption((opt) => opt.setName('gizli').setDescription('Yanıt size özel olsun').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guild) { await interaction.reply({ content: 'Bu komut sadece sunucularda.', ephemeral: true }); return; }
	const page = Math.max(1, interaction.options.getInteger('sayfa') ?? 1);
	const limit = 10;
	const offset = (page - 1) * limit;
	const ephemeral = interaction.options.getBoolean('gizli') ?? false;

	const settings = await getLevelSettings(interaction.guild.id);
	if (!settings.enabled) { await interaction.reply({ content: 'Seviye sistemi bu sunucuda kapalı.', ephemeral: true }); return; }

	const rows = await getTopUsers(interaction.guild.id, limit, offset);
	const mapped = await Promise.all(rows.map(async (r, idx) => {
		const user = await interaction.client.users.fetch(r.userId).catch(() => null);
		return {
			rank: offset + idx + 1,
			username: user?.username ?? r.userId,
			level: r.level,
			xp: r.xpTotal,
			avatarUrl: user?.displayAvatarURL({ size: 128 }) ?? undefined,
		};
	}));

	const img = await renderLeaderboard({ title: `${interaction.guild.name} • Liderlik Tablosu (Sayfa ${page})`, rows: mapped });

	await interaction.reply({
		embeds: [{ title: 'Liderlik', image: { url: `attachment://${img.fileName}` } }],
		files: [{ attachment: img.buffer, name: img.fileName }],
		ephemeral,
		allowedMentions: { parse: [] },
	});
}

export default { data, execute };


