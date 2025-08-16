import { ChatInputCommandInteraction, ChannelType, PermissionsBitField, SlashCommandBuilder, TextChannel, Role } from 'discord.js';
import { setRegistrationChannel, setRegisteredRole, setReviewChannel, getRegistrationSettings } from '../lib/registration';
import { applyNewMemberRolePermissions, applyReviewChannelPermissions } from '../lib/permissions';

const data = new SlashCommandBuilder()
	.setName('kayit-ayar-kanal')
	.setDescription('Kayıt panelinin bulunduğu kanalı ayarlar (Yalnızca Yönetici).')
	.setDMPermission(false)
	.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
	.addChannelOption((opt) =>
		opt.setName('kanal').setDescription('Kayıt kanalı').setRequired(true).addChannelTypes(ChannelType.GuildText)
	)
	.addRoleOption((opt) =>
		opt.setName('kayitli-rol').setDescription('Kayıt sonrası verilecek rol').setRequired(true)
	)
	.addChannelOption((opt) =>
		opt.setName('kontrol-kanali').setDescription('Kayıt kontrol kanalı').setRequired(false).addChannelTypes(ChannelType.GuildText)
	);

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guild) {
		await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
		return;
	}
	const channel = interaction.options.getChannel('kanal', true) as TextChannel;
	const role = interaction.options.getRole('kayitli-rol', true) as Role;
	const reviewChannel = interaction.options.getChannel('kontrol-kanali') as TextChannel | null;

	await setRegistrationChannel(interaction.guild.id, channel.id);
	await setRegisteredRole(interaction.guild.id, role.id);
	if (reviewChannel) {
		await setReviewChannel(interaction.guild.id, reviewChannel.id);
	}

	// İzinleri uygula: kayıt kanalı sadece yeni üyeler, kontrol kanalı sadece yetkili roller
	const settings = await getRegistrationSettings(interaction.guild.id);
	if (settings?.newMemberRoleId) {
		await applyNewMemberRolePermissions(interaction.guild, settings.newMemberRoleId, channel.id);
	}
	if (reviewChannel && settings) {
		await applyReviewChannelPermissions(interaction.guild, reviewChannel.id, settings.allowedRoleIds);
	}

	await interaction.reply({ content: `Kayıt kanalı ${channel} ve kayıtlı rolü <@&${role.id}> olarak ayarlandı.${reviewChannel ? ` Kayıt kontrol kanalı: ${reviewChannel}.` : ''}`, ephemeral: true });
}

export default { data, execute };


