import { ActionRowBuilder, ChatInputCommandInteraction, PermissionFlagsBits, RoleSelectMenuBuilder, SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { deleteWarn, getWarnSettings, listWarns } from '../lib/warn';

const data = new SlashCommandBuilder()
	.setName('uyari-sil')
	.setDescription('Bir kullanıcının uyarılarından birini sil')
	.setDMPermission(false)
	.addUserOption((opt) =>
		opt.setName('kisi').setDescription('Uyarıları görüntülenecek kullanıcı').setRequired(true)
	);

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guild) {
		await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
		return;
	}

	// Yetki kontrolü: Yönetici veya izinli roller
	const settings = await getWarnSettings(interaction.guild.id);
	const member = await interaction.guild.members.fetch(interaction.user.id);
	const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
	const hasAllowedRole = settings.allowedRoleIds.length > 0 && settings.allowedRoleIds.some((r) => member.roles.cache.has(r));
	if (!isAdmin && !hasAllowedRole) {
		await interaction.reply({ content: 'Bu komutu kullanma yetkiniz yok.', ephemeral: true });
		return;
	}

	const targetUser = interaction.options.getUser('kisi', true);
	const warns = await listWarns(interaction.guild.id, targetUser.id, 25);
	if (!warns.length) {
		await interaction.reply({ content: 'Bu kullanıcının kayıtlı uyarısı yok.', ephemeral: true });
		return;
	}

	const options = warns.map((w) => new StringSelectMenuOptionBuilder()
		.setLabel(`#${w.id} • ${new Date(w.created_at).toLocaleString()}`)
		.setDescription(`${(w.reason || '—').slice(0, 80)}`)
		.setValue(w.id)
	);

	const menu = new StringSelectMenuBuilder()
		.setCustomId(`warnadmin:delete:${targetUser.id}`)
		.setPlaceholder('Silinecek uyarıyı seçin')
		.addOptions(options);
	const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);

	await interaction.reply({ content: `${targetUser} kullanıcısının uyarıları:`, components: [row], ephemeral: true, allowedMentions: { parse: [] } });
}

export default { data, execute };


