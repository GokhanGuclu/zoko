import {
	CategoryChannel,
	ChannelType,
	ChatInputCommandInteraction,
	GuildBasedChannel,
	PermissionsBitField,
	SlashCommandBuilder,
	TextChannel,
} from 'discord.js';

const data = new SlashCommandBuilder()
	.setName('destek-sil')
	.setDescription('Sunucudaki tüm ticket kanallarını ve (varsa) panel mesajlarını kaldırır (Yalnızca Yöneticiler).')
	.setDMPermission(false)
	.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
	.addChannelOption((opt) =>
		opt
			.setName('panel-kanali')
			.setDescription('Panel mesajının bulunduğu kanal (opsiyonel)')
			.setRequired(false)
			.addChannelTypes(ChannelType.GuildText)
	);

async function deletePanelMessages(channel: TextChannel): Promise<number> {
	let deleted = 0;
	try {
		const messages = await channel.messages.fetch({ limit: 50 });
		for (const [, msg] of messages) {
			const hasPanelEmbed = msg.embeds.some((e) => e.title === 'Destek Paneli');
			const hasTicketCreate = (msg.components as any[]).some((row: any) =>
				Array.isArray(row.components) && row.components.some((c: any) => c.customId?.startsWith('ticket:create'))
			);
			if (hasPanelEmbed || hasTicketCreate) {
				await msg.delete().catch(() => {});
				deleted++;
			}
		}
	} catch {
		// yetki/erişim hataları yoksayılır
	}
	return deleted;
}

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guild) {
		await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
		return;
	}

	await interaction.deferReply({ ephemeral: true });

	const guild = interaction.guild;
	let deletedTickets = 0;
	let deletedPanels = 0;
	let deletedCategories = 0;

	// Ticket kanallarını sil
	for (const [, ch] of guild.channels.cache) {
		if (ch.type !== ChannelType.GuildText) continue;
		const text = ch as TextChannel;
		const isTicketByTopic = typeof text.topic === 'string' && text.topic.startsWith('TICKET_USER:');
		const isTicketByName = text.name.startsWith('ticket-');
		if (isTicketByTopic || isTicketByName) {
			await text.delete().catch(() => {});
			deletedTickets++;
		}
	}

	// Panel kanalında panel mesajlarını sil (opsiyonel)
	const panelChannel = interaction.options.getChannel('panel-kanali', false) as TextChannel | null;
	if (panelChannel && panelChannel.type === ChannelType.GuildText) {
		deletedPanels = await deletePanelMessages(panelChannel);
	}

	// "ticket" adlı boş kategorileri temizle
	for (const [, ch] of guild.channels.cache) {
		if (ch.type !== ChannelType.GuildCategory) continue;
		const cat = ch as CategoryChannel;
		if (cat.name.toLowerCase() !== 'ticket') continue;
		const children: GuildBasedChannel[] = guild.channels.cache.filter((c) => (c as any).parentId === cat.id).toJSON();
		if (children.length === 0) {
			await cat.delete().catch(() => {});
			deletedCategories++;
		}
	}

	await interaction.editReply({
		content: `Silindi: ticket kanalı=${deletedTickets}, panel mesajı=${deletedPanels}, boş kategori=${deletedCategories}`,
	});
}

export default { data, execute };


