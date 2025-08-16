import { ChatInputCommandInteraction, PermissionsBitField, SlashCommandBuilder } from 'discord.js';
import { addFaq } from '../lib/faq';

const data = new SlashCommandBuilder()
	.setName('destek-soru-olustur')
	.setDescription('Soru/Cevap (SSS) maddesi ekler (Yalnızca Yöneticiler).')
	.setDMPermission(false)
	.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
	.addStringOption((opt) =>
		opt.setName('baslik').setDescription('Başlık').setRequired(true)
	)
	.addStringOption((opt) =>
		opt.setName('soru').setDescription('Soru').setRequired(true)
	)
	.addStringOption((opt) =>
		opt.setName('cevap').setDescription('Cevap').setRequired(true)
	);

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guild) {
		await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
		return;
	}

	const title = interaction.options.getString('baslik', true);
	const question = interaction.options.getString('soru', true);
	const answer = interaction.options.getString('cevap', true);

	const entry = await addFaq(interaction.guild.id, { title, question, answer });
	await interaction.reply({ content: `SSS eklendi: ${entry.title} (ID: ${entry.id})`, ephemeral: true });
}

export default { data, execute };


