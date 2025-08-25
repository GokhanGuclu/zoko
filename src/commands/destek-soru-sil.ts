import { ChatInputCommandInteraction, PermissionsBitField, SlashCommandBuilder } from 'discord.js';
import { deleteFaq, findFaq } from '../lib/faq';

const data = new SlashCommandBuilder()
	.setName('destek-soru-sil')
	.setDescription('[DEVRE DISI] SSS yönetimi web paneline taşındı.')
	.setDMPermission(false)
	.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator);

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guild) {
		await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
		return;
	}

	await interaction.reply({ content: 'Bu komut devre dışı. Lütfen SSS yönetimi için web panelini kullanın.', ephemeral: true });
}

export default { data, execute };


