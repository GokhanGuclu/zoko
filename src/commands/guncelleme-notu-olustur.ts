import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionsBitField } from 'discord.js';
import { addReleaseNote } from '../lib/releaseNotes';
import { buildEmbed } from '../lib/ui';

const data = new SlashCommandBuilder()
    .setName('guncelleme-notu-olustur')
    .setDescription('Sürüm ve güncelleme içeriğini kaydeder (Yönetici)')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    // Zorunlu seçenekler önce
    .addStringOption((opt) => opt.setName('surum').setDescription('Sürüm (ör. 1.0.1)').setRequired(true))
    .addStringOption((opt) => opt.setName('icerik').setDescription('Güncelleme notu içeriği').setRequired(true))
    // İsteğe bağlı en sonra
    .addStringOption((opt) => opt.setName('baslik').setDescription('Başlık').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const version = interaction.options.getString('surum', true).trim();
    const rawBody = interaction.options.getString('icerik', true);
    // Kullanıcı tek satırda \n yazarsa gerçek satır sonlarına çevir
    const body = rawBody
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t');
    const title = interaction.options.getString('baslik')?.trim() || null;
    const guildId = interaction.guildId ?? null;
    const createdBy = interaction.user?.id ?? null;

    const saved = await addReleaseNote({ version, title, body, guildId, createdBy });
    const embed = buildEmbed({
        title: 'Güncelleme Notu Kaydedildi',
        fields: [
            { name: 'Sürüm', value: saved.version, inline: true },
            { name: 'Başlık', value: saved.title || '—', inline: true },
        ],
        description: saved.body.slice(0, 4000),
        color: 0x22c55e,
        timestamp: true,
    });
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

export default { data, execute };


