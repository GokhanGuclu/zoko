import { ChatInputCommandInteraction, GuildMember, PermissionsBitField, SlashCommandBuilder, TextChannel } from 'discord.js';
import { buildEmbed, formatFooter } from '../lib/ui';
import { getWarnSettings } from '../lib/warn';

const data = new SlashCommandBuilder()
	.setName('unmute')
	.setDescription('Susturmayı (timeout) kaldırır')
	.addUserOption((opt) => opt.setName('uye').setDescription('Susturması kaldırılacak üye').setRequired(true));

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guild) {
		await interaction.reply({ content: 'Bu komut sadece sunucuda kullanılabilir.', ephemeral: true });
		return;
	}
	if (!interaction.member || !(interaction.member as GuildMember).permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
		await interaction.reply({ content: 'Bu komutu kullanmak için "Üyeleri Zaman Aşımına Uğrat" iznine sahip olmalısınız.', ephemeral: true });
		return;
	}
	const target = interaction.options.getMember('uye') as GuildMember | null;
	if (!target) {
		await interaction.reply({ content: 'Üye bulunamadı.', ephemeral: true });
		return;
	}
	try {
		await target.timeout(null);
		await interaction.reply({ content: `Susturma kaldırıldı: <@${target.id}>` });
		// System-log gönder
		try {
			const settings = await getWarnSettings(interaction.guild.id);
			if (settings.logChannelId) {
				const ch = interaction.guild.channels.cache.get(settings.logChannelId) as TextChannel | undefined;
				if (ch) {
					const embed = buildEmbed({
						title: '🔊 Susturma Kaldırıldı',
						description: `Kullanıcı <@${target.id}> için susturma kaldırıldı.`,
						fields: [
							{ name: 'Kullanıcı', value: `<@${target.id}> (${target.id})`, inline: true },
							{ name: 'Yetkili', value: `<@${interaction.user.id}>`, inline: true },
						],
						color: 0x22c55e,
						footerText: formatFooter(interaction.guild.name),
						timestamp: true,
					});
					await ch.send({ embeds: [embed] });
				}
			}
		} catch {}
	} catch {
		await interaction.reply({ content: 'Susturma kaldırılamadı. Bot izinlerini ve rol sırasını kontrol edin.', ephemeral: true });
	}
}

export default { data, execute };


