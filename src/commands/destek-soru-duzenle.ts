import { ChatInputCommandInteraction, PermissionsBitField, SlashCommandBuilder } from 'discord.js';
import { findFaq, updateFaq } from '../lib/faq';

const data = new SlashCommandBuilder()
	.setName('destek-soru-duzenle')
	.setDescription('Var olan SSS maddesini düzenler (Yalnızca Yöneticiler).')
	.setDMPermission(false)
	.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
	.addStringOption((opt) =>
		opt.setName('id').setDescription('SSS ID').setRequired(true)
	)
	.addStringOption((opt) =>
		opt.setName('baslik').setDescription('Yeni başlık').setRequired(false)
	)
	.addStringOption((opt) =>
		opt.setName('soru').setDescription('Yeni soru').setRequired(false)
	)
	.addStringOption((opt) =>
		opt.setName('cevap').setDescription('Yeni cevap').setRequired(false)
	);

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guild) {
		await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
		return;
	}

	const id = interaction.options.getString('id', true);
	const title = interaction.options.getString('baslik') ?? undefined;
	const question = interaction.options.getString('soru') ?? undefined;
	const answer = interaction.options.getString('cevap') ?? undefined;

	if (!title && !question && !answer) {
		await interaction.reply({ content: 'Düzenlemek için en az bir alan (başlık/soru/cevap) belirtmelisiniz.', ephemeral: true });
		return;
	}

	const existing = await findFaq(interaction.guild.id, id);
	if (!existing) {
		await interaction.reply({ content: 'Bu ID ile bir SSS bulunamadı.', ephemeral: true });
		return;
	}

	const updated = await updateFaq(interaction.guild.id, id, { title, question, answer });
	await interaction.reply({ content: `SSS güncellendi: ${updated?.title} (ID: ${id})`, ephemeral: true });
}

export default { data, execute };


