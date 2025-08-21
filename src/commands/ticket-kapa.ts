import { ChatInputCommandInteraction, PermissionsBitField, SlashCommandBuilder, TextChannel } from 'discord.js';
import { scheduleChannelClose, extractOpenedUserIdFromTopic } from '../lib/tickets';
import { ensureLogChannel, exportChannelTranscript, postClosureSummary } from '../lib/logs';
import { getAndClearFlowEvents } from '../lib/flow';

const data = new SlashCommandBuilder()
	.setName('ticket-kapa')
	.setDescription('Bu ticket kanalını 1 dakika sonra kapatır (Destek rolü veya Yönetici).')
	.setDMPermission(false)
	.setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels);

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guild || !interaction.channel) {
		await interaction.reply({ content: 'Bu komut bir ticket kanalında kullanılmalıdır.', ephemeral: true });
		return;
	}
	const channel = interaction.channel as TextChannel;
	await interaction.reply({ content: 'Ticket kapatma zamanlandı: 1 dakika içinde kanal kapanacak.' });
	await scheduleChannelClose(channel, interaction.user.id, 60_000, async () => {
		const logChannel = await ensureLogChannel(interaction.guild!, channel.parentId ?? null);
		if (logChannel) {
			const transcript = await exportChannelTranscript(channel);
			const flow = getAndClearFlowEvents(channel.id);
			const openedUserId = extractOpenedUserIdFromTopic(channel.topic) || interaction.user.id;
			await postClosureSummary(logChannel, {
				guildName: interaction.guild!.name,
				channelName: channel.name,
				openedByUserId: openedUserId,
				flow,
			});
			if (transcript.length) {
				await logChannel.send({
					content: 'Sohbet dökümü:',
					files: [{ attachment: Buffer.from(transcript, 'utf8'), name: `${channel.name}-transcript.txt` }],
				});
			}
		}
	});
}

export default { data, execute };


