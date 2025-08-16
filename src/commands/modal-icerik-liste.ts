import { ChatInputCommandInteraction, PermissionsBitField, SlashCommandBuilder } from 'discord.js';
import { listModalFields } from '../lib/registration';

const data = new SlashCommandBuilder()
	.setName('modal-icerik-liste')
	.setDescription('Kayıt modalındaki alanları listeler (Yalnızca Yönetici).')
	.setDMPermission(false)
	.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator);

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guild) {
		await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
		return;
	}
	const fields = await listModalFields(interaction.guild.id);
	if (fields.length === 0) {
		await interaction.reply({ content: 'Henüz alan yok.', ephemeral: true });
		return;
	}
	const lines = fields.map((f, i) => `${i + 1}. [${f.id}] ${f.label} (${f.custom_id}) - ${f.style} ${f.required ? 'Z' : ''} sira:${f.order}`);
	await interaction.reply({ content: lines.join('\n'), ephemeral: true });
}

export default { data, execute };


