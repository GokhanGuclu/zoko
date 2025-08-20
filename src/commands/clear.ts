import { ChatInputCommandInteraction, PermissionsBitField, SlashCommandBuilder, TextChannel } from 'discord.js';

const data = new SlashCommandBuilder()
	.setName('clear')
	.setDescription('Kanaldaki mesajları toplu siler (maks 100)')
	.setDMPermission(false)
	.setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages)
	.addIntegerOption((opt) =>
		opt
			.setName('miktar')
			.setDescription('Silinecek mesaj sayısı (1-100)')
			.setRequired(true)
			.setMinValue(1)
			.setMaxValue(100)
	);

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guild) {
		await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
		return;
	}
	const member = interaction.member;
	if (!member || !(('permissions' in member) && (member as any).permissions.has(PermissionsBitField.Flags.ManageMessages))) {
		await interaction.reply({ content: 'Bu komutu kullanmak için "Mesajları Yönet" iznine sahip olmalısınız.', ephemeral: true });
		return;
	}
	const amount = interaction.options.getInteger('miktar', true);
	const channel = interaction.channel as TextChannel | null;
	if (!channel || !('bulkDelete' in channel)) {
		await interaction.reply({ content: 'Bu kanalda toplu silme desteklenmiyor.', ephemeral: true });
		return;
	}
	try {
		const deleted = await channel.bulkDelete(amount, true);
		await interaction.reply({ content: `🧹 ${deleted.size} mesaj silindi. (14 günden eski mesajlar silinmez)`, ephemeral: true });
	} catch (e) {
		await interaction.reply({ content: 'Mesajlar silinemedi. Bot izinlerini kontrol edin.', ephemeral: true });
	}
}

export default { data, execute };


