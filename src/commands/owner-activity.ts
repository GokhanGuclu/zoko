import { ActivityType, ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { config as appConfig } from '../config';

const STATUS_CHOICES = [
    { name: 'online', value: 'online' },
    { name: 'idle', value: 'idle' },
    { name: 'dnd', value: 'dnd' },
    { name: 'invisible', value: 'invisible' },
] as const;

const TYPE_CHOICES = [
    { name: 'playing', value: 'playing' },
    { name: 'streaming', value: 'streaming' },
    { name: 'listening', value: 'listening' },
    { name: 'watching', value: 'watching' },
    { name: 'competing', value: 'competing' },
    { name: 'custom', value: 'custom' },
] as const;

type StatusValue = typeof STATUS_CHOICES[number]['value'];
type TypeValue = typeof TYPE_CHOICES[number]['value'];

const data = new SlashCommandBuilder()
    .setName('owner-activity')
    .setDescription('Bot etkinlik/durum ayarları (Sadece bot sahibi).')
    .setDMPermission(true)
    .addSubcommand((sub) =>
        sub
            .setName('set')
            .setDescription('Etkinlik ve durumu ayarla')
            .addStringOption((opt) =>
                opt
                    .setName('type')
                    .setDescription('Etkinlik tipi')
                    .setRequired(true)
                    .addChoices(...TYPE_CHOICES)
            )
            .addStringOption((opt) =>
                opt
                    .setName('name')
                    .setDescription('Etkinlik adı / Custom için durum metni')
                    .setRequired(true)
            )
            .addStringOption((opt) =>
                opt
                    .setName('url')
                    .setDescription('Streaming için URL (Twitch vb.)')
                    .setRequired(false)
            )
            .addStringOption((opt) =>
                opt
                    .setName('status')
                    .setDescription('Durum')
                    .setRequired(false)
                    .addChoices(...STATUS_CHOICES)
            )
    )
    .addSubcommand((sub) =>
        sub
            .setName('clear')
            .setDescription('Etkinlikleri temizle (durum kalır)')
            .addStringOption((opt) =>
                opt
                    .setName('status')
                    .setDescription('Durumu da güncelle (opsiyonel)')
                    .setRequired(false)
                    .addChoices(...STATUS_CHOICES)
            )
    );

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!appConfig.ownerUserId || interaction.user.id !== appConfig.ownerUserId) {
        await interaction.reply({ content: 'Bu komutu sadece bot sahibi kullanabilir.', ephemeral: true });
        return;
    }
    const sub = interaction.options.getSubcommand();

    if (sub === 'set') {
        const type = interaction.options.getString('type', true) as TypeValue;
        const nameRaw = interaction.options.getString('name', true);
        const name = (nameRaw ?? '').toString();
        const url = interaction.options.getString('url') ?? undefined;
        const status = (interaction.options.getString('status') as StatusValue | null) ?? null;

        if (!name || typeof name !== 'string') {
            await interaction.reply({ content: 'Geçerli bir etkinlik adı girin.', ephemeral: true });
            return;
        }

        let activity: any;
        if (type === 'custom') {
            // djs v14: name zorunlu string, custom metin state alanına yazılır
            activity = { type: ActivityType.Custom, name: 'Custom Status', state: name };
        } else if (type === 'streaming') {
            if (!url || !url.startsWith('http')) {
                await interaction.reply({ content: 'Streaming için geçerli bir URL girin (https://...).', ephemeral: true });
                return;
            }
            activity = { type: ActivityType.Streaming, name, url };
        } else if (type === 'playing') {
            activity = { type: ActivityType.Playing, name };
        } else if (type === 'listening') {
            activity = { type: ActivityType.Listening, name };
        } else if (type === 'watching') {
            activity = { type: ActivityType.Watching, name };
        } else if (type === 'competing') {
            activity = { type: ActivityType.Competing, name };
        }

        await interaction.client.user?.setPresence({
            activities: activity ? [activity] : [],
            status: status ?? interaction.client.user?.presence?.status ?? 'online',
        });
        await interaction.reply({ content: 'Etkinlik güncellendi.', ephemeral: true });
        return;
    }

    if (sub === 'clear') {
        const status = (interaction.options.getString('status') as StatusValue | null) ?? null;
        await interaction.client.user?.setPresence({
            activities: [],
            status: status ?? interaction.client.user?.presence?.status ?? 'online',
        });
        await interaction.reply({ content: 'Etkinlikler temizlendi.', ephemeral: true });
        return;
    }
}

export default { data, execute };


