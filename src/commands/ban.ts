import { ChatInputCommandInteraction, GuildMember, PermissionsBitField, SlashCommandBuilder, TextChannel } from 'discord.js';
import { buildEmbed, formatFooter } from '../lib/ui';
import { getWarnSettings } from '../lib/warn';

const data = new SlashCommandBuilder()
	.setName('ban')
	.setDescription('Bir üyeyi sunucudan yasaklar')
	.setDMPermission(false)
	.setDefaultMemberPermissions(PermissionsBitField.Flags.BanMembers)
	.addUserOption((opt) => opt.setName('uye').setDescription('Yasaklanacak üye').setRequired(true))
	.addIntegerOption((opt) => opt.setName('sil_gun').setDescription('Son X gün mesajlarını sil (0-7)').setMinValue(0).setMaxValue(7).setRequired(false))
	.addStringOption((opt) => opt.setName('sebep').setDescription('Sebep').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guild) {
		await interaction.reply({ content: 'Bu komut sadece sunucuda kullanılabilir.', ephemeral: true });
		return;
	}
	if (!interaction.member || !(interaction.member as GuildMember).permissions.has(PermissionsBitField.Flags.BanMembers)) {
		await interaction.reply({ content: 'Gerekli izne sahip değilsiniz (Üyeleri Yasakla).', ephemeral: true });
		return;
	}
	const target = interaction.options.getMember('uye') as GuildMember | null;
	const reason = interaction.options.getString('sebep') || '—';
	const delDays = interaction.options.getInteger('sil_gun') ?? 0;
	const me = interaction.guild.members.me;
	if (!target) {
		await interaction.reply({ content: 'Üye bulunamadı.', ephemeral: true });
		return;
	}
	if (target.id === interaction.user.id) {
		await interaction.reply({ content: 'Kendinizi yasaklayamazsınız.', ephemeral: true });
		return;
	}
	if (!me) {
		await interaction.reply({ content: 'Bot üye bilgisi alınamadı.', ephemeral: true });
		return;
	}
	if (!target.bannable || target.roles.highest.position >= me.roles.highest.position) {
		await interaction.reply({ content: 'Bu üyeyi yasaklayamıyorum. Botun rolü yeterli değil veya hedef yasaklanamaz.', ephemeral: true });
		return;
	}
	try {
		await interaction.guild.members.ban(target.id, { reason: `${reason} • by ${interaction.user.tag}`, deleteMessageDays: delDays });
		const embed = buildEmbed({
			title: '🔨 Üye Yasaklandı',
			description: `Kullanıcı <@${target.id}> sunucudan yasaklandı.`,
			fields: [
				{ name: 'Kullanıcı', value: `<@${target.id}> (${target.id})`, inline: true },
				{ name: 'Yetkili', value: `<@${interaction.user.id}>`, inline: true },
				{ name: 'Silinen Mesaj Gün', value: String(delDays), inline: true },
				{ name: 'Sebep', value: reason, inline: false },
			],
			color: 0x991b1b,
			footerText: formatFooter(interaction.guild.name),
			timestamp: true,
		});
		await interaction.reply({ embeds: [embed] });
		// System-log gönder
		try {
			const settings = await getWarnSettings(interaction.guild.id);
			if (settings.logChannelId) {
				const ch = interaction.guild.channels.cache.get(settings.logChannelId) as TextChannel | undefined;
				if (ch) await ch.send({ embeds: [embed] });
			}
		} catch {}
	} catch {
		await interaction.reply({ content: 'Üye yasaklanamadı. İzinleri ve rol sırasını kontrol edin.', ephemeral: true });
	}
}

export default { data, execute };


