import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { buildEmbed, formatFooter } from '../lib/ui';
import { getLatestReleaseNote } from '../lib/releaseNotes';

const data = new SlashCommandBuilder()
    .setName('guncelleme')
    .setDescription('Son güncelleme notunu gösterir');

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = interaction.guildId ?? null;
    const latest = await getLatestReleaseNote(guildId);
    if (!latest) {
        await interaction.reply({ content: 'Henüz bir güncelleme notu bulunmuyor.', ephemeral: true });
        return;
    }
    const embed = buildEmbed({
        title: latest.title || `Sürüm ${latest.version}`,
        description: latest.body.slice(0, 4000),
        color: 0x8b5cf6,
        footerText: formatFooter(interaction.guild?.name || 'ZoKo'),
        timestamp: true,
    });
    await interaction.reply({ embeds: [embed] });
}

export default { data, execute };


