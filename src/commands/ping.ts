import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

const data = new SlashCommandBuilder()
	.setName('ping')
	.setDescription('Pong ve ping değerlerini gösterir');

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	const latencyMs = Date.now() - interaction.createdTimestamp;
	const apiPingMs = Math.round(interaction.client.ws.ping);
	await interaction.reply(`🏓 Pong!\n• Komut gecikmesi: ${latencyMs}ms\n• API ping: ${apiPingMs}ms`);
}

export default { data, execute };


