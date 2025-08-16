import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getWarnSettings, listWarns } from '../lib/warn';
import { buildEmbed, formatFooter } from '../lib/ui';

const data = new SlashCommandBuilder()
    .setName('uyari-liste')
    .setDescription('Bir kullanıcının uyarılarını listeler')
    .setDMPermission(false)
    .addUserOption((opt) =>
        opt.setName('kisi').setDescription('Uyarıları görüntülenecek kullanıcı (boş bırakılırsa kendiniz)').setRequired(false)
    );

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
        await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
        return;
    }

    const settings = await getWarnSettings(interaction.guild.id);
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
    const hasAllowedRole = settings.allowedRoleIds.length > 0 && settings.allowedRoleIds.some((r) => member.roles.cache.has(r));

    const targetUser = interaction.options.getUser('kisi') ?? interaction.user;
    const isSelf = targetUser.id === interaction.user.id;
    if (!isSelf && !isAdmin && !hasAllowedRole) {
        await interaction.reply({ content: 'Bu komutu kullanma yetkiniz yok.', ephemeral: true });
        return;
    }

    const warns = await listWarns(interaction.guild.id, targetUser.id, 25);
    if (!warns.length) {
        await interaction.reply({ content: `${isSelf ? 'Sizin' : `${targetUser}`} uyarı kaydı bulunmuyor.`, ephemeral: true, allowedMentions: { parse: [] } });
        return;
    }

    const lines: string[] = [];
    for (let i = 0; i < warns.length; i++) {
        const w = warns[i];
        const reason = (w.reason || '—').toString().slice(0, 140);
        const date = new Date(w.created_at).toLocaleString();
        const parts = [
            `${i + 1}. ID: ${w.id} • Tarih: ${date}`,
            `Sebep: ${reason}`,
            `Yetkili: <@${w.moderator_id}>`,
        ];
        if (w.image_url) parts.push(`[📎 Resim](${w.image_url})`);
        lines.push(parts.join('\n'));
    }

    const embed = buildEmbed({
        title: 'Uyarı Listesi',
        description: lines.join('\n\n'),
        color: 0x64748b,
        footerText: formatFooter(interaction.guild.name),
        timestamp: true,
    });

    await interaction.reply({ embeds: [embed], ephemeral: true, allowedMentions: { parse: [] } });
}

export default { data, execute };


