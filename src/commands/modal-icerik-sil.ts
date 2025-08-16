import { ChatInputCommandInteraction, PermissionsBitField, SlashCommandBuilder } from 'discord.js';
import { deleteModalField } from '../lib/registration';

const data = new SlashCommandBuilder()
	.setName('modal-icerik-sil')
	.setDescription('Kayıt modalından bir alanı siler (Yalnızca Yönetici).')
	.setDMPermission(false)
	.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
	.addStringOption((opt) => opt.setName('id').setDescription('Alan ID').setRequired(true));

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guild) {
		await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
		return;
	}
	const id = interaction.options.getString('id', true);
	const ok = await deleteModalField(interaction.guild.id, id);
	await interaction.reply({ content: ok ? 'Alan silindi.' : 'Silme başarısız.', ephemeral: true });
}

export default { data, execute };


