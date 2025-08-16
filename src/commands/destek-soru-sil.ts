import { ChatInputCommandInteraction, PermissionsBitField, SlashCommandBuilder } from 'discord.js';
import { deleteFaq, findFaq } from '../lib/faq';

const data = new SlashCommandBuilder()
	.setName('destek-soru-sil')
	.setDescription('Var olan SSS maddesini siler (Yalnızca Yöneticiler).')
	.setDMPermission(false)
	.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
	.addStringOption((opt) =>
		opt.setName('id').setDescription('SSS ID').setRequired(true)
	);

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guild) {
		await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
		return;
	}

	const id = interaction.options.getString('id', true);
	const exists = await findFaq(interaction.guild.id, id);
	if (!exists) {
		await interaction.reply({ content: 'Bu ID ile bir SSS bulunamadı.', ephemeral: true });
		return;
	}

	const ok = await deleteFaq(interaction.guild.id, id);
	await interaction.reply({ content: ok ? 'SSS silindi.' : 'Silme başarısız.', ephemeral: true });
}

export default { data, execute };


