import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { getLevelSettings, getUserLevel, getUserRank, totalXpForLevel } from '../lib/levels';
import { renderRankCard } from '../lib/levelImages';

const data = new SlashCommandBuilder()
	.setName('seviye')
	.setDescription('Seviyenizi veya seçtiğiniz kişinin seviyesini gösterir')
	.setDMPermission(false)
	.addUserOption((opt) => opt.setName('kisi').setDescription('Kişi').setRequired(false))
	.addBooleanOption((opt) => opt.setName('gizli').setDescription('Yanıt size özel olsun').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guild) { await interaction.reply({ content: 'Bu komut sadece sunucularda.', ephemeral: true }); return; }
	const target = interaction.options.getUser('kisi') ?? interaction.user;
	const ephemeral = interaction.options.getBoolean('gizli') ?? false;

	const settings = await getLevelSettings(interaction.guild.id);
	if (!settings.enabled) { await interaction.reply({ content: 'Seviye sistemi bu sunucuda kapalı.', ephemeral: true }); return; }

	const { level, xpTotal } = await getUserLevel(interaction.guild.id, target.id);
	const nextLevel = level + 1;
	const nextNeedTotal = totalXpForLevel(nextLevel);
	const currentNeedTotal = totalXpForLevel(level);
	const xpCurrentLevel = Math.max(0, xpTotal - currentNeedTotal);
	const xpNeeded = Math.max(1, nextNeedTotal - currentNeedTotal);
	const rank = await getUserRank(interaction.guild.id, xpTotal);

	const presence = interaction.guild.members.me ? await interaction.guild.members.fetch(target.id).catch(() => null) : null;
	const status = (presence?.presence?.status ?? null) as any;
	const img = await renderRankCard({
		username: target.username,
		avatarUrl: target.displayAvatarURL({ size: 256 }),
		level,
		xpTotal,
		xpCurrentLevel,
		xpNeeded,
		rank,
		status,
	});

	await interaction.reply({
		embeds: [{ title: `${target.username} — Seviye`, image: { url: `attachment://${img.fileName}` } }],
		files: [{ attachment: img.buffer, name: img.fileName }],
		ephemeral,
		allowedMentions: { parse: [] },
	});
}

export default { data, execute };


