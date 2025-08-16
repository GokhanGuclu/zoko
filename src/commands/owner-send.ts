import { ChatInputCommandInteraction, Client, Guild, GuildTextBasedChannel, PermissionsBitField, SlashCommandBuilder } from 'discord.js';
import { config as appConfig } from '../config';

const data = new SlashCommandBuilder()
    .setName('owner-send')
    .setDescription('Belirtilen sunucudaki bir kanala mesaj gönderir (Sadece bot sahibi).')
    .setDMPermission(true)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addStringOption((opt) => opt.setName('guild_id').setDescription('Sunucu ID').setRequired(true))
    .addStringOption((opt) => opt.setName('channel_id').setDescription('Kanal ID').setRequired(true))
    .addStringOption((opt) => opt.setName('mesaj').setDescription('Gönderilecek mesaj').setRequired(true));

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.client || !interaction.user) return;
    if (!appConfig.ownerUserId || interaction.user.id !== appConfig.ownerUserId) {
        await interaction.reply({ content: 'Bu komutu sadece bot sahibi kullanabilir.', ephemeral: true });
        return;
    }
    const guildId = interaction.options.getString('guild_id', true);
    const channelId = interaction.options.getString('channel_id', true);
    const message = interaction.options.getString('mesaj', true);

    try {
        const guild = await interaction.client.guilds.fetch(guildId).catch(() => null);
        if (!guild) {
            await interaction.reply({ content: 'Sunucu bulunamadı veya bota yetki verilmemiş.', ephemeral: true });
            return;
        }
        const channel = await guild.channels.fetch(channelId).catch(() => null);
        if (!channel || !channel.isTextBased()) {
            await interaction.reply({ content: 'Kanal bulunamadı veya metin kanalı değil.', ephemeral: true });
            return;
        }
        await (channel as GuildTextBasedChannel).send({ content: message });
        await interaction.reply({ content: `Mesaj gönderildi: https://discord.com/channels/${guildId}/${channelId}`, ephemeral: true });
    } catch (e) {
        await interaction.reply({ content: 'Mesaj gönderilemedi.', ephemeral: true });
    }
}

export default { data, execute };


