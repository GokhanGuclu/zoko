import { ChatInputCommandInteraction, PermissionsBitField, Role, SlashCommandBuilder } from 'discord.js';
import { setAllowedRoles } from '../lib/registration';

const data = new SlashCommandBuilder()
	.setName('kayit-ayar-roller')
	.setDescription('Kayıt yapabilen roller listesini ayarlar (Yalnızca Yönetici).')
	.setDMPermission(false)
	.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
	.addRoleOption((opt) => opt.setName('rol1').setDescription('Rol').setRequired(true))
	.addRoleOption((opt) => opt.setName('rol2').setDescription('Rol').setRequired(false))
	.addRoleOption((opt) => opt.setName('rol3').setDescription('Rol').setRequired(false))
	.addRoleOption((opt) => opt.setName('rol4').setDescription('Rol').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guild) {
		await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
		return;
	}
	const roles: string[] = [];
	for (let i = 1; i <= 4; i++) {
		const r = interaction.options.getRole(`rol${i}`) as Role | null;
		if (r) roles.push(r.id);
	}
	await setAllowedRoles(interaction.guild.id, roles);
	await interaction.reply({ content: `Kayıt yapabilen roller ayarlandı: ${roles.map((id) => `<@&${id}>`).join(', ') || '(yok)'}`, ephemeral: true });
}

export default { data, execute };


