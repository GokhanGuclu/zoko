import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { config as appConfig } from '../config';

const data = new SlashCommandBuilder()
    .setName('owner-restart')
    .setDescription('Botu güvenli şekilde yeniden başlatır (Sadece bot sahibi).')
    .setDMPermission(false)
    .setDefaultMemberPermissions(0);

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!appConfig.ownerUserId || interaction.user.id !== appConfig.ownerUserId) {
        await interaction.reply({ content: 'Bu komutu sadece bot sahibi kullanabilir.', ephemeral: true });
        return;
    }
    await interaction.reply({ content: 'Yeniden başlatılıyor...', ephemeral: true });
    // Process manager (PM2/Docker/systemd) tarafından yeniden başlatılacağı varsayılır
    setTimeout(() => {
        process.exit(0);
    }, 500);
}

export default { data, execute };


