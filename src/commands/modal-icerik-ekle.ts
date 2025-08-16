import { ChatInputCommandInteraction, PermissionsBitField, SlashCommandBuilder } from 'discord.js';
import { addModalField } from '../lib/registration';

const data = new SlashCommandBuilder()
	.setName('modal-icerik-ekle')
	.setDescription('Kayıt modalına yeni bir metin alanı ekler (Yalnızca Yönetici).')
	.setDMPermission(false)
	.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
	.addStringOption((opt) => opt.setName('custom_id').setDescription('Alan kimliği').setRequired(true))
	.addStringOption((opt) => opt.setName('etiket').setDescription('Görünen etiket').setRequired(true))
	.addStringOption((opt) => opt.setName('stil').setDescription('short | paragraph').setRequired(true).addChoices({ name: 'short', value: 'short' }, { name: 'paragraph', value: 'paragraph' }))
	.addBooleanOption((opt) => opt.setName('zorunlu').setDescription('Zorunlu mu?').setRequired(true))
	.addStringOption((opt) => opt.setName('placeholder').setDescription('Yer tutucu').setRequired(false))
	.addIntegerOption((opt) => opt.setName('min').setDescription('Minimum karakter').setRequired(false))
	.addIntegerOption((opt) => opt.setName('max').setDescription('Maksimum karakter').setRequired(false))
	.addIntegerOption((opt) => opt.setName('sira').setDescription('Sıra').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guild) {
		await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
		return;
	}
	const custom_id = interaction.options.getString('custom_id', true);
	const label = interaction.options.getString('etiket', true);
	const style = interaction.options.getString('stil', true) as 'short' | 'paragraph';
	const required = interaction.options.getBoolean('zorunlu', true);
	const placeholder = interaction.options.getString('placeholder') ?? null;
	const min_length = interaction.options.getInteger('min') ?? null;
	const max_length = interaction.options.getInteger('max') ?? null;
	const order = interaction.options.getInteger('sira') ?? 0;

	await addModalField(interaction.guild.id, { custom_id, label, style, required, placeholder, min_length, max_length, order });
	await interaction.reply({ content: `Alan eklendi: ${label} (${custom_id})`, ephemeral: true });
}

export default { data, execute };


