import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

const data = new SlashCommandBuilder()
	.setName('hello')
	.setDescription('Selam verir')
	.addStringOption((opt) =>
		opt
			.setName('name')
			.setDescription('İsminiz (opsiyonel)')
			.setRequired(false)
	);

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	const name = interaction.options.getString('name');
	const who = name || interaction.user.displayName || interaction.user.username;
	await interaction.reply(`👋 Merhaba, ${who}!`);
}

export default { data, execute };


