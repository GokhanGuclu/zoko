import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, User } from 'discord.js';
import { buildEmbed, formatFooter, getBrandLogoAttachment } from '../lib/ui';
import { getRpsContextId, startRps, setRpsMessageId } from '../lib/rps';
import { renderRps } from '../lib/rpsImage';

function genToken(): string {
  return Math.random().toString(36).slice(2, 10);
}

const data = new SlashCommandBuilder()
  .setName('tkm')
  .setDescription('Taş-Kağıt-Makas başlat')
  .setDMPermission(false)
  .addUserOption((opt) => opt.setName('rakip').setDescription('Karşı oynayacağınız kişi (boşsa bot)'))
  .addIntegerOption((opt) => opt.setName('tur').setDescription('Kaç tur (3 veya 5)').addChoices({ name: '3', value: 3 }, { name: '5', value: 5 }));

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) { await interaction.reply({ content: 'Sadece sunucularda.', ephemeral: true }); return; }
  const opponent: User | null = interaction.options.getUser('rakip');
  const bestOf = (interaction.options.getInteger('tur') as 3 | 5 | null) ?? 3;
  const ctx = getRpsContextId(interaction.guild.id, interaction.channelId);
  const token = genToken();

  if (!opponent || opponent.bot) {
    // Bot ile
    const state = startRps(ctx, interaction.user.id, 'bot', bestOf, token);
    const img = await renderRps(state, {
      playerX: { name: interaction.user.username, avatarUrl: interaction.user.displayAvatarURL({ size: 128, extension: 'png' }) },
      playerO: { name: 'Bot', avatarUrl: interaction.client.user?.displayAvatarURL({ size: 128, extension: 'png' }) ?? undefined },
    });
    const embed = buildEmbed({ title: 'ZoKo Games • Taş • Kağıt • Makas', description: `En iyi ${bestOf} tur. Aşağıdaki butonlardan seçimini yap.`, imageUrl: `attachment://${img.fileName}`, footerText: formatFooter(interaction.guild.name), timestamp: true, authorName: 'ZoKo Games', authorIconUrl: getBrandLogoAttachment()?.url, thumbnailUrl: getBrandLogoAttachment()?.url });
    const row = choiceRow(token);
    const logo = getBrandLogoAttachment();
    const files = logo ? [{ attachment: img.buffer, name: img.fileName }, logo.file] : [{ attachment: img.buffer, name: img.fileName }];
    const msg = await interaction.reply({ embeds: [embed], files, components: [row], fetchReply: true as any });
    try { setRpsMessageId(token, (msg as any).id); } catch {}
    return;
  }

  if (opponent.id === interaction.user.id) { await interaction.reply({ content: 'Kendinle oynayamazsın.', ephemeral: true }); return; }

  // Davet
  const inviteEmbed = buildEmbed({ title: 'TKM Davet', description: `<@${opponent.id}>, <@${interaction.user.id}> TKM oynamak istiyor. Kabul ediyor musun?`, footerText: formatFooter(interaction.guild.name), timestamp: true });
  const yesBtn = new ButtonBuilder().setCustomId(`tkm:invite:yes:${token}:${interaction.user.id}:${opponent.id}:${bestOf}`).setLabel('Evet').setEmoji('✅').setStyle(ButtonStyle.Success);
  const noBtn = new ButtonBuilder().setCustomId(`tkm:invite:no:${token}:${interaction.user.id}:${opponent.id}:${bestOf}`).setLabel('Hayır').setEmoji('❌').setStyle(ButtonStyle.Danger);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(yesBtn, noBtn);
  await interaction.reply({ content: `<@${opponent.id}>`, embeds: [inviteEmbed], components: [row], allowedMentions: { users: [opponent.id] } });
}

export function choiceRow(token: string) {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`tkm:choose:${token}:rock`).setLabel('Taş 🪨').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`tkm:choose:${token}:paper`).setLabel('Kağıt 📄').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`tkm:choose:${token}:scissors`).setLabel('Makas ✂️').setStyle(ButtonStyle.Secondary),
  );
  return row;
}

export function openChoiceRow(token: string, enableX: boolean, enableO: boolean) {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`tkm:open:${token}:X`).setLabel('X seçimini yap').setStyle(ButtonStyle.Primary).setDisabled(!enableX),
    new ButtonBuilder().setCustomId(`tkm:open:${token}:O`).setLabel('O seçimini yap').setStyle(ButtonStyle.Primary).setDisabled(!enableO),
  );
  return row;
}

export default { data, execute };


