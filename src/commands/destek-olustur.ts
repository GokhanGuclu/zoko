import {
	ActionRowBuilder,
	ChannelType,
	ChatInputCommandInteraction,
	PermissionsBitField,
	SlashCommandBuilder,
	TextChannel,
	Role,
	ButtonBuilder,
	ButtonStyle,
} from 'discord.js';
import { buildEmbed, formatFooter } from '../lib/ui';

const data = new SlashCommandBuilder()
	.setName('destek-olustur')
	.setDescription('Belirtilen kanala destek paneli kurar (Yalnızca Yöneticiler).')
	.setDMPermission(false)
	.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
	.addChannelOption((opt) =>
		opt
			.setName('secilen-kanal')
			.setDescription('Panelin gönderileceği metin kanalı')
			.setRequired(true)
			.addChannelTypes(ChannelType.GuildText)
	)
	.addRoleOption((opt) =>
		opt
			.setName('destek-rolu')
			.setDescription('Etiketlenecek destek rolü (opsiyonel)')
			.setRequired(false)
	);

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guild) {
		await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
		return;
	}

	const channel = interaction.options.getChannel('secilen-kanal', true);
	if (channel.type !== ChannelType.GuildText) {
		await interaction.reply({ content: 'Lütfen bir metin kanalı seçin.', ephemeral: true });
		return;
	}

	const textChannel = channel as TextChannel;
	const supportRole = interaction.options.getRole('destek-rolu') as Role | null;

	// Kanalı kilitle (herkes yazamasın)
	const everyoneRole = interaction.guild.roles.everyone;
	await textChannel.permissionOverwrites.edit(everyoneRole, {
		SendMessages: false,
		AddReactions: false,
		CreatePublicThreads: false,
		CreatePrivateThreads: false,
		SendMessagesInThreads: false,
	});

	// Embed (tek tip)
	const embed = buildEmbed({
		title: 'Destek Paneli',
		description: 'Bir destek talebi oluşturmak için aşağıdaki butona basın.',
		color: 0x22c55e,
		footerText: interaction.guild.name,
	});

	const button = new ButtonBuilder()
		.setCustomId(`ticket:create:${supportRole?.id ?? ''}`)
		.setLabel('Destek Talebi Oluştur')
		.setEmoji('🎫')
		.setStyle(ButtonStyle.Secondary);
	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

	const content = supportRole ? `<@&${supportRole.id}>` : undefined;
	await textChannel.send({ content, embeds: [embed], components: [row] });

	await interaction.reply({ content: `Destek paneli ${textChannel} kanalına kuruldu.`, ephemeral: true });
}

export default { data, execute };


