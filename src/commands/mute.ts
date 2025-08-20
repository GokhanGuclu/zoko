import { ChatInputCommandInteraction, GuildMember, PermissionsBitField, SlashCommandBuilder, TextChannel } from 'discord.js';
import { buildEmbed, formatFooter } from '../lib/ui';
import { getWarnSettings } from '../lib/warn';

const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000; // 28 gün

const data = new SlashCommandBuilder()
	.setName('mute')
	.setDescription('Bir üyeyi belirli süre susturur (timeout) — hiçbir kanala yazamaz.')
	.addUserOption((opt) =>
		opt.setName('uye').setDescription('Susturulacak üye').setRequired(true)
	)
	.addStringOption((opt) =>
		opt
			.setName('sure')
			.setDescription('Süre (ör. 10m, 1h, 1d). Maks: 28g')
			.setRequired(true)
			.addChoices(
				{ name: '5 dakika', value: '5m' },
				{ name: '10 dakika', value: '10m' },
				{ name: '1 saat', value: '1h' },
				{ name: '6 saat', value: '6h' },
				{ name: '12 saat', value: '12h' },
				{ name: '1 gün', value: '1d' },
				{ name: '3 gün', value: '3d' },
				{ name: '7 gün', value: '7d' },
				{ name: '28 gün (maks)', value: '28d' },
			)
	)
	.addStringOption((opt) =>
		opt.setName('sebep').setDescription('Sebep').setRequired(false)
	);

function parseDurationMs(input: string): number | null {
	const match = input.trim().toLowerCase().match(/^([0-9]+)\s*([smhdw])$/);
	if (!match) return null;
	const value = Number(match[1]);
	const unit = match[2];
	const unitMs: Record<string, number> = {
		s: 1000,
		m: 60 * 1000,
		h: 60 * 60 * 1000,
		d: 24 * 60 * 60 * 1000,
		w: 7 * 24 * 60 * 60 * 1000,
	};
	return value * (unitMs[unit] || 0);
}

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guild) {
		await interaction.reply({ content: 'Bu komut sadece sunucuda kullanılabilir.', ephemeral: true });
		return;
	}
	const me = interaction.guild.members.me;
	if (!interaction.member || !(interaction.member as GuildMember).permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
		await interaction.reply({ content: 'Bu komutu kullanmak için "Üyeleri Zaman Aşımına Uğrat" iznine sahip olmalısınız.', ephemeral: true });
		return;
	}
	const target = interaction.options.getMember('uye') as GuildMember | null;
	const durationRaw = (interaction.options.getString('sure', true) || '').trim();
	const reason = interaction.options.getString('sebep') || '—';
	if (!target) {
		await interaction.reply({ content: 'Üye bulunamadı.', ephemeral: true });
		return;
	}
	if (!me) {
		await interaction.reply({ content: 'Bot üye bilgisi alınamadı.', ephemeral: true });
		return;
	}
	if (target.id === interaction.user.id) {
		await interaction.reply({ content: 'Kendinizi susturamazsınız.', ephemeral: true });
		return;
	}
	if (target.roles.highest.position >= me.roles.highest.position) {
		await interaction.reply({ content: 'Bu üyeyi susturmak için botun rolü daha yüksek olmalı.', ephemeral: true });
		return;
	}
	const ms = parseDurationMs(durationRaw);
	if (!ms || ms <= 0) {
		await interaction.reply({ content: 'Geçerli bir süre girin. Örnek: 10m, 1h, 1d', ephemeral: true });
		return;
	}
	if (ms > MAX_TIMEOUT_MS) {
		await interaction.reply({ content: 'Süre 28 günü aşamaz.', ephemeral: true });
		return;
	}
	try {
		await target.timeout(ms, `${reason} • by ${interaction.user.tag}`);
		const until = new Date(Date.now() + ms);
		const embed = buildEmbed({
			title: '🔇 Üye Susturuldu',
			description: `Kullanıcı <@${target.id}> ${durationRaw} süreyle susturuldu.`,
			fields: [
				{ name: 'Kullanıcı', value: `<@${target.id}> (${target.id})`, inline: true },
				{ name: 'Yetkili', value: `<@${interaction.user.id}>`, inline: true },
				{ name: 'Süre', value: durationRaw, inline: true },
				{ name: 'Sebep', value: reason, inline: false },
				{ name: 'Bitiş', value: until.toLocaleString(), inline: false },
			],
			color: 0xF97316,
			footerText: formatFooter(interaction.guild.name),
			timestamp: true,
		});
		await interaction.reply({ embeds: [embed] });

		// System-log gönder
		try {
			const settings = await getWarnSettings(interaction.guild.id);
			if (settings.logChannelId) {
				const ch = interaction.guild.channels.cache.get(settings.logChannelId) as TextChannel | undefined;
				if (ch) {
					await ch.send({ embeds: [embed] });
				}
			}
		} catch {}
	} catch (e) {
		await interaction.reply({ content: 'Susturma uygulanamadı. Bot izinlerini ve rol sırasını kontrol edin.', ephemeral: true });
	}
}

export default { data, execute };


