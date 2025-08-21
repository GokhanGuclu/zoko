import { ChatInputCommandInteraction, GuildMember, PermissionsBitField, SlashCommandBuilder, TextChannel } from 'discord.js';
import { buildEmbed, formatFooter } from '../lib/ui';
import { getWarnSettings } from '../lib/warn';

const data = new SlashCommandBuilder()
	.setName('kick')
	.setDescription('Bir üyeyi sunucudan atar')
	.setDMPermission(false)
	.setDefaultMemberPermissions(PermissionsBitField.Flags.KickMembers)
	.addUserOption((opt) => opt.setName('uye').setDescription('Atılacak üye').setRequired(true))
	.addStringOption((opt) => opt.setName('sebep').setDescription('Sebep').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guild) {
		await interaction.reply({ content: 'Bu komut sadece sunucuda kullanılabilir.', ephemeral: true });
		return;
	}
	if (!interaction.member || !(interaction.member as GuildMember).permissions.has(PermissionsBitField.Flags.KickMembers)) {
		await interaction.reply({ content: 'Gerekli izne sahip değilsiniz (Üyeleri At).', ephemeral: true });
		return;
	}
	const target = interaction.options.getMember('uye') as GuildMember | null;
	const reason = interaction.options.getString('sebep') || '—';
	const me = interaction.guild.members.me;
	if (!target) {
		await interaction.reply({ content: 'Üye bulunamadı.', ephemeral: true });
		return;
	}
	if (target.id === interaction.user.id) {
		await interaction.reply({ content: 'Kendinizi atamazsınız.', ephemeral: true });
		return;
	}
	if (!me) {
		await interaction.reply({ content: 'Bot üye bilgisi alınamadı.', ephemeral: true });
		return;
	}
	if (!target.kickable || target.roles.highest.position >= me.roles.highest.position) {
		await interaction.reply({ content: 'Bu üyeyi atamıyorum. Botun rolü yeterli değil veya hedef atılamaz.', ephemeral: true });
		return;
	}
	try {
		await target.kick(`${reason} • by ${interaction.user.tag}`);
		const embed = buildEmbed({
			title: '👢 Üye Atıldı',
			description: `Kullanıcı <@${target.id}> sunucudan atıldı.`,
			fields: [
				{ name: 'Kullanıcı', value: `<@${target.id}> (${target.id})`, inline: true },
				{ name: 'Yetkili', value: `<@${interaction.user.id}>`, inline: true },
				{ name: 'Sebep', value: reason, inline: true },
			],
			color: 0xef4444,
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
		await interaction.reply({ content: 'Üye atılamadı. İzinleri ve rol sırasını kontrol edin.', ephemeral: true });
	}
}

export default { data, execute };


