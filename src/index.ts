import { Client, Collection, Events, GatewayIntentBits, Interaction, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { config as appConfig } from './config';
import { commands } from './commands';
import { deployCommands } from './lib/deployCommands';
import { createTicketChannel, extractSupportRoleIdFromTopic } from './lib/tickets';
import { findFaq } from './lib/faq';
import { buildEmbed, formatFooter } from './lib/ui';
import { ensureSchema } from './lib/db';
import { ensureLogChannel, exportChannelTranscript, postClosureSummary } from './lib/logs';
import { addFlowEvent, getAndClearFlowEvents } from './lib/flow';
import { setWarnLogChannel, setWarnAllowedRoles, clearAllWarns, deleteWarn, getWarnById, getWarnSettings } from './lib/warn';
import { buildRegistrationModal, getRegistrationSettings, listModalFields, saveSubmission, setRegistrationChannel, setRegisteredRole, addModalField, deleteModalField, setNewMemberRole, approveSubmission, rejectSubmission } from './lib/registration';
import { applyNewMemberRolePermissions } from './lib/permissions';

type CommandMap = Collection<string, (interaction: Interaction) => Promise<void>>;

const client = new Client({ intents: [
	GatewayIntentBits.Guilds,
	GatewayIntentBits.GuildMessages,
	GatewayIntentBits.MessageContent,
	GatewayIntentBits.GuildMessageReactions,
	GatewayIntentBits.GuildMembers,
] });

const commandMap: CommandMap = new Collection();
for (const cmd of commands) {
	commandMap.set(cmd.data.name, (interaction) => cmd.execute(interaction as any));
}

client.once(Events.ClientReady, async (c) => {
	console.log(`🤖 Giriş yapıldı: ${c.user.tag}`);
	try {
		await ensureSchema();
		await deployCommands();
		console.log(`📝 Slash komutları otomatik dağıtıldı (${commands.length})`);
		for (let index = 0; index < commands.length; index++) {
			const command = commands[index];
			try {
				// Komutun temel özelliklerini kontrol et
				if (!command.data || !command.execute) {
					console.error(`❌ ${command.data?.name || 'İsimsiz komut'} komutunda eksik özellikler var!`);
					continue;
				}
				
				// Komut adı ve açıklaması kontrol et
				if (!command.data.name || !command.data.description) {
					console.error(`❌ ${command.data.name || 'İsimsiz komut'} komutunda isim veya açıklama eksik!`);
					continue;
				}

				console.log(`✅ ${index + 1}. ${command.data.name} komut hazır!`);
			} catch (cmdErr) {
				console.error(`❌ ${command.data?.name || 'İsimsiz komut'} komut yüklenirken hata:`, cmdErr);
			}
		}
	} catch (err) {
		console.error('❌ Slash komutları dağıtılırken hata:', err);
	}
});

// Yeni üye katılınca kayıt kanalı mesajı ve yeni üye rolü
client.on(Events.GuildMemberAdd, async (member) => {
	try {
		const settings = await getRegistrationSettings(member.guild.id);
		if (settings?.newMemberRoleId) {
			await member.roles.add(settings.newMemberRoleId).catch(() => {});
		}
		if (!settings || !settings.channelId) return;
		const channel = member.guild.channels.cache.get(settings.channelId) as TextChannel | undefined;
		if (!channel) return;
		const embed = buildEmbed({
			title: 'Kayıt Gerekli',
			description: `${member}, sunucuya hoş geldin! Kayıt olmak için aşağıdaki butona bas.`,
			color: 0x22c55e,
			footerText: formatFooter(member.guild.name),
			timestamp: true,
		});
		const btn = new ButtonBuilder().setCustomId('reg:open').setLabel('Kayıt Ol').setStyle(ButtonStyle.Primary);
		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(btn);
		await channel.send({ content: `${member}`, embeds: [embed], components: [row] });
	} catch (e) {
		console.error('Kayıt mesajı gönderilemedi:', e);
	}
});

client.on(Events.InteractionCreate, async (interaction) => {
	// Slash komutları
	if (interaction.isChatInputCommand()) {
		const handler = commandMap.get(interaction.commandName);
		if (!handler) {
			await interaction.reply({ content: 'Komut bulunamadı.', ephemeral: true });
			return;
		}
		try {
			await handler(interaction);
		} catch (error) {
			console.error('Komut çalıştırma hatası:', error);
			if (interaction.deferred || interaction.replied) {
				await interaction.followUp({ content: 'Bir hata oluştu.', ephemeral: true });
			} else {
				await interaction.reply({ content: 'Bir hata oluştu.', ephemeral: true });
			}
		}
		return;
	}

	// Kayıt butonu
	if (interaction.isButton() && interaction.customId === 'reg:open') {
		if (!interaction.guild || interaction.user.bot) return;
		try {
			const modal = await buildRegistrationModal(interaction.guild.id);
			if (!modal) {
				await interaction.reply({ content: 'Kayıt formu henüz hazırlanmadı. Lütfen sonra tekrar deneyin.', ephemeral: true });
				return;
			}
			await interaction.showModal(modal);
		} catch (e) {
			console.error('Modal gösterilemedi:', e);
			if (!interaction.replied && !interaction.deferred) {
				await interaction.reply({ content: 'Modal açılamadı.', ephemeral: true });
			}
		}
		return;
	}

	// Kayıt modal submit
	if (interaction.isModalSubmit() && interaction.customId === 'reg:submit') {
		if (!interaction.guild) return;
		try {
			const fields = await listModalFields(interaction.guild.id);
			const payload: Record<string, string> = {};
			for (const f of fields) {
				payload[f.custom_id] = interaction.fields.getTextInputValue(f.custom_id);
			}
			const submissionId = await saveSubmission(interaction.guild.id, interaction.user.id, payload);
			const settings = await getRegistrationSettings(interaction.guild.id);
			// Kullanıcıya bilgilendirme
			const confirmEmbed = buildEmbed({
				title: 'Kayıt Başvurusu Alındı',
				description: 'Başvurun incelemeye gönderildi. Onaylandığında bilgilendirileceksin.',
				color: 0x38bdf8,
				footerText: formatFooter(interaction.guild.name),
				timestamp: true,
			});
			await interaction.reply({ embeds: [confirmEmbed], ephemeral: true });
			// Yetkililere bildirim
			if (settings?.reviewChannelId) {
				const reviewCh = interaction.guild.channels.cache.get(settings.reviewChannelId) as TextChannel | undefined;
				if (reviewCh) {
					const reviewEmbed = buildEmbed({
						title: 'Yeni Kayıt Başvurusu',
						description: `Kullanıcı: <@${interaction.user.id}>\nID: ${submissionId}`,
						fields: Object.entries(payload).slice(0, 10).map(([k, v]) => ({ name: k, value: String(v).slice(0, 1024) })),
						color: 0xf59e0b,
						footerText: formatFooter(interaction.guild.name),
						timestamp: true,
					});
					const approveBtn = new ButtonBuilder().setCustomId(`regreview:approve:${submissionId}`).setLabel('Onayla').setStyle(ButtonStyle.Success);
					const rejectBtn = new ButtonBuilder().setCustomId(`regreview:reject:${submissionId}`).setLabel('Reddet').setStyle(ButtonStyle.Danger);
					const row = new ActionRowBuilder<ButtonBuilder>().addComponents(approveBtn, rejectBtn);
					await reviewCh.send({ embeds: [reviewEmbed], components: [row] });
				}
			}
		} catch (e) {
			console.error('Kayıt submit hatası:', e);
			if (!interaction.replied && !interaction.deferred) {
				await interaction.reply({ content: 'Kayıt sırasında hata oluştu.', ephemeral: true });
			}
		}
		return;
	}

	// Kayıt inceleme butonları (customId: regreview:approve|reject:SUBMISSION_ID)
	if (interaction.isButton() && interaction.customId.startsWith('regreview:')) {
		if (!interaction.guild || interaction.user.bot) return;
		const [, action, submissionId] = interaction.customId.split(':');
		const settings = await getRegistrationSettings(interaction.guild.id);
		if (action === 'approve') {
			const ok = await approveSubmission(interaction.guild.id, submissionId, interaction.user.id);
			if (!ok) {
				await interaction.reply({ content: 'Onay başarısız veya zaten işlem görmüş.', ephemeral: true });
				return;
			}
			// Roller
			try {
				if (settings?.registeredRoleId) {
					const member = await interaction.guild.members.fetch((interaction.message.embeds[0]?.description || '').match(/<@([0-9]+)>/)?.[1] || '');
					await member.roles.add(settings.registeredRoleId).catch(() => {});
					if (settings.newMemberRoleId) await member.roles.remove(settings.newMemberRoleId).catch(() => {});
					// Kullanıcıya DM
					await member.send({ embeds: [buildEmbed({ title: 'Kayıt Onaylandı', description: `${interaction.guild.name} sunucusunda kaydın onaylandı. Keyifli sohbetler!`, color: 0x22c55e })] }).catch(() => {});
				}
			} catch {}
			// Mesajı güncelle (butonları kapat)
			try {
				const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder().setCustomId('disabled-approve').setLabel('Onaylandı').setStyle(ButtonStyle.Success).setDisabled(true),
					new ButtonBuilder().setCustomId('disabled-reject').setLabel('Reddedildi').setStyle(ButtonStyle.Danger).setDisabled(true),
				);
				await interaction.message.edit({ components: [row] });
			} catch {}
			await interaction.reply({ content: 'Başvuru onaylandı.', ephemeral: true });
			return;
		}
		if (action === 'reject') {
			const ok = await rejectSubmission(interaction.guild.id, submissionId, interaction.user.id, null);
			if (!ok) {
				await interaction.reply({ content: 'Reddetme başarısız veya zaten işlem görmüş.', ephemeral: true });
				return;
			}
			// Kullanıcıya DM bilgi
			try {
				const memberId = (interaction.message.embeds[0]?.description || '').match(/<@([0-9]+)>/)?.[1];
				if (memberId) {
					const member = await interaction.guild.members.fetch(memberId);
					await member.send({ embeds: [buildEmbed({ title: 'Kayıt Reddedildi', description: `${interaction.guild.name} sunucusunda kaydın şimdilik onaylanmadı. Lütfen kayıt kanalındaki yönergeleri takip et.`, color: 0xef4444 })] }).catch(() => {});
				}
			} catch {}
			// Mesajı güncelle (butonları kapat)
			try {
				const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder().setCustomId('disabled-approve').setLabel('Onaylandı').setStyle(ButtonStyle.Success).setDisabled(true),
					new ButtonBuilder().setCustomId('disabled-reject').setLabel('Reddedildi').setStyle(ButtonStyle.Danger).setDisabled(true),
				);
				await interaction.message.edit({ components: [row] });
			} catch {}
			await interaction.reply({ content: 'Başvuru reddedildi.', ephemeral: true });
			return;
		}
	}

	// Destek paneli butonu (customId: ticket:create[:SUPPORT_ROLE_ID])
	if (interaction.isButton() && interaction.customId.startsWith('ticket:create')) {
		if (!interaction.guild || !interaction.member || interaction.user.bot) return;
		try {
			const parts = interaction.customId.split(':');
			const supportRoleId = parts[2] || undefined;
			const channel = await createTicketChannel(interaction.member as any, supportRoleId);
			// İstek gereği: ephemeral cevap gönderilmesin; bunun yerine kanala karşılayıcı mesaj atılsın
			await channel.send(`Merhaba ${interaction.user}, talebiniz alındı. Aşağıdaki seçeneklerden ihtiyacınıza uygun olanı seçiniz.`);
			addFlowEvent(channel.id, 'Ticket açıldı ve kullanıcı bilgilendirildi.');
			// Olası SSS butonlarını yayınla
			await (await import('./lib/faq')).sendFaqMenu(channel, interaction.guild.id);
			// 10 saniye sonra "Anlaşıldı mı?" onayı
			setTimeout(async () => {
				try {
					const confirmEmbed = buildEmbed({
						title: 'Onay',
						description: 'Anlaşıldı mı?',
						color: 0x38bdf8,
						footerText: formatFooter(interaction.guild!.name),
						timestamp: true,
					});
					const yesBtn = new ButtonBuilder().setCustomId('ticket:confirm:yes').setLabel('Evet').setStyle(ButtonStyle.Success);
					const noBtn = new ButtonBuilder().setCustomId('ticket:confirm:no').setLabel('Hayır').setStyle(ButtonStyle.Danger);
					const row = new ActionRowBuilder<ButtonBuilder>().addComponents(yesBtn, noBtn);
					await (channel as TextChannel).send({ embeds: [confirmEmbed], components: [row] });
					addFlowEvent((channel as TextChannel).id, 'Kullanıcıya "Anlaşıldı mı?" sorusu yöneltildi.');
				} catch (e) {
					console.error('Onay embed gönderilemedi:', e);
				}
			}, 10_000);
			if (!interaction.replied && !interaction.deferred) {
				await interaction.deferUpdate();
			}
		} catch (err) {
			console.error('Ticket oluşturulamadı:', err);
			if (!interaction.replied && !interaction.deferred) {
				await interaction.reply({ content: 'Ticket oluşturulurken bir hata oluştu.', ephemeral: true });
			}
		}
	}

	// SSS seçim menüsü (customId: ticket:faq:select)
	if (interaction.isStringSelectMenu() && interaction.customId === 'ticket:faq:select') {
		if (!interaction.guild || !interaction.channel || interaction.user.bot) return;
		const faqId = interaction.values[0];
		const entry = await findFaq(interaction.guild.id, faqId);
		if (!entry) {
			await interaction.reply({ content: 'Bu seçenek bulunamadı.', ephemeral: true });
			return;
		}
		const embed = buildEmbed({
			title: 'Yanıt',
			fields: [
				{ name: 'Soru', value: entry.question },
				{ name: 'Cevap', value: entry.answer },
			],
			color: 0x3b82f6,
			footerText: formatFooter(interaction.guild.name),
			timestamp: true,
		});
		await interaction.reply({ embeds: [embed] });
		addFlowEvent(interaction.channel!.id, `SSS yanıtlandı: ${entry.title}`);
	}

	// Onay butonları (customId: ticket:confirm:yes|no)
	if (interaction.isButton() && interaction.customId.startsWith('ticket:confirm:')) {
		if (!interaction.guild || !interaction.channel || interaction.user.bot) return;
		const choice = interaction.customId.split(':')[2];
		if (choice === 'no') {
			const embed = buildEmbed({
				title: 'Canlı Destek',
				description: 'Canlı destekle görüşmek ister misin?',
				color: 0xf97316,
				footerText: formatFooter(interaction.guild.name),
				timestamp: true,
			});
			const yesBtn = new ButtonBuilder().setCustomId('ticket:live:yes').setLabel('Evet').setStyle(ButtonStyle.Primary);
			const noBtn = new ButtonBuilder().setCustomId('ticket:live:no').setLabel('Hayır').setStyle(ButtonStyle.Secondary);
			const row = new ActionRowBuilder<ButtonBuilder>().addComponents(yesBtn, noBtn);
			await interaction.reply({ embeds: [embed], components: [row] });
			addFlowEvent(interaction.channel!.id, 'Kullanıcı anlaşılamadı; canlı destek teklifi sunuldu.');
		} else {
			await interaction.reply({ content: 'Harika! Destek görüşmeniz 1 dakika içinde kapatılacaktır.' });
			addFlowEvent(interaction.channel!.id, 'Kullanıcı "Evet (anlaşıldı)" dedi; kapanış planlandı.');
			setTimeout(async () => {
				try {
					const channel = interaction.channel as TextChannel;
					const logChannel = await ensureLogChannel(interaction.guild!, channel.parentId ?? null);
					if (logChannel) {
						const transcript = await exportChannelTranscript(channel);
						const flow = getAndClearFlowEvents(channel.id);
						await postClosureSummary(logChannel, {
							guildName: interaction.guild!.name,
							channelName: channel.name,
							openedByUserId: interaction.user.id,
							flow,
						});
						if (transcript.length) {
							await logChannel.send({
								content: 'Sohbet dökümü:',
								files: [{ attachment: Buffer.from(transcript, 'utf8'), name: `${channel.name}-transcript.txt` }],
							});
						}
					}
					await channel.delete();
				} catch (e) {
					console.error('Kanal kapatma başarısız:', e);
				}
			}, 60_000);
		}
	}

	// Canlı destek akışı (customId: ticket:live:yes|no)
	if (interaction.isButton() && interaction.customId.startsWith('ticket:live:')) {
		if (!interaction.guild || !interaction.channel || interaction.user.bot) return;
		const choice = interaction.customId.split(':')[2];
		if (choice === 'yes') {
			const embed = buildEmbed({
				title: 'Canlı Destek',
				description: 'Canlı desteği bağlıyorum...',
				color: 0x22c55e,
				footerText: formatFooter(interaction.guild.name),
				timestamp: true,
			});
			await interaction.reply({ embeds: [embed] });
			setTimeout(async () => {
				try {
					const channel = interaction.channel as TextChannel;
					const supportFromTopic = extractSupportRoleIdFromTopic(channel.topic);
					const supportRoleId = supportFromTopic || appConfig.supportRoleId;
					if (supportRoleId) {
						await channel.permissionOverwrites.edit(supportRoleId, {
							ViewChannel: true,
							SendMessages: true,
							ReadMessageHistory: true,
						});
						await channel.send({ content: `<@&${supportRoleId}> En müsait canlı destek yakında sizinle birlikte olacak.` });
						addFlowEvent(channel.id, 'Canlı destek çağrıldı ve rol bilgilendirildi.');
					} else {
						await channel.send('En müsait canlı destek yakında sizinle birlikte olacak. (Destek rolü tanımlı değil)');
					}
				} catch (e) {
					console.error('Canlı destek bilgilendirmesi başarısız:', e);
				}
			}, 10_000);
		} else {
			await interaction.reply({ content: 'Tamamdır, ihtiyacınız olursa yazabilirsiniz.', ephemeral: true });
			addFlowEvent(interaction.channel!.id, 'Kullanıcı canlı destek istemedi.');
		}
	}

	// Admin panel butonları
	if (interaction.isButton() && interaction.customId.startsWith('regadmin:')) {
		if (!interaction.guild || !interaction.member || interaction.user.bot) return;
		const action = interaction.customId.split(':')[1];

		if (action === 'setChannel') {
			const channelSelect = new ChannelSelectMenuBuilder()
				.setCustomId('regadmin:setChannel:select')
				.setPlaceholder('Kayıt kanalını seçin');
			const row = new ActionRowBuilder<ChannelSelectMenuBuilder>()
				.addComponents(channelSelect);
			await interaction.reply({ content: 'Kayıt kanalını seçin:', components: [row], ephemeral: true });
			addFlowEvent(interaction.channel!.id, 'Kayıt kanalı seçimi isteniyor.');
		} else if (action === 'setRole') {
			const roleSelect = new RoleSelectMenuBuilder()
				.setCustomId('regadmin:setRole:select')
				.setPlaceholder('Kayıt rolünü seçin');
			const row = new ActionRowBuilder<RoleSelectMenuBuilder>()
				.addComponents(roleSelect);
			await interaction.reply({ content: 'Kayıt rolünü seçin:', components: [row], ephemeral: true });
			addFlowEvent(interaction.channel!.id, 'Kayıt rolü seçimi isteniyor.');
		} else if (action === 'setNewMemberRole') {
			const roleSelect = new RoleSelectMenuBuilder()
				.setCustomId('regadmin:setNewMemberRole:select')
				.setPlaceholder('Yeni üye rolünü seçin');
			const row = new ActionRowBuilder<RoleSelectMenuBuilder>()
				.addComponents(roleSelect);
			await interaction.reply({ content: 'Yeni üye rolünü seçin:', components: [row], ephemeral: true });
			addFlowEvent(interaction.channel!.id, 'Yeni üye rolü seçimi isteniyor.');
		} else if (action === 'setReviewChannel') {
			const channelSelect = new ChannelSelectMenuBuilder()
				.setCustomId('regadmin:setReviewChannel:select')
				.setPlaceholder('Kayıt kontrol kanalını seçin');
			const row = new ActionRowBuilder<ChannelSelectMenuBuilder>()
				.addComponents(channelSelect);
			await interaction.reply({ content: 'Kayıt kontrol kanalını seçin:', components: [row], ephemeral: true });
			addFlowEvent(interaction.channel!.id, 'Kayıt kontrol kanalı seçimi isteniyor.');
		} else if (interaction.customId === 'regadmin:modal') {
			const fields = await listModalFields(interaction.guild.id);
			const infoBtn = new ButtonBuilder().setCustomId('regadmin:modal:info').setLabel('Bilgi').setStyle(ButtonStyle.Secondary);
			const createBtn = new ButtonBuilder().setCustomId('regadmin:modal:create').setLabel('Yeni Alan Ekle').setStyle(ButtonStyle.Success);
			const deleteBtn = new ButtonBuilder().setCustomId('regadmin:modal:delete').setLabel('Alan Sil').setStyle(ButtonStyle.Danger);
			const row = new ActionRowBuilder<ButtonBuilder>().addComponents(createBtn, deleteBtn);
			const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(infoBtn);

			const lines = fields.length
				? fields.map((f, i) => `${i + 1}. [${f.id}] ${f.label} (${f.custom_id}) • ${f.style} ${f.required ? 'Z' : ''} sira:${f.order}`).join('\n')
				: 'Henüz alan yok.';
			const embed = buildEmbed({
				title: 'Kayıt Modal Yönetimi',
				description: lines,
				color: 0x3b82f6,
				footerText: formatFooter(interaction.guild.name),
				timestamp: true,
			});
			await interaction.reply({ embeds: [embed], components: [row, row2], ephemeral: true });
			addFlowEvent(interaction.channel!.id, 'Kayıt modal yönetim paneli gösterildi.');
		} else if (action === 'applyPerms') {
			const s = await getRegistrationSettings(interaction.guild.id);
			if (!s?.newMemberRoleId || !s?.channelId) {
				await interaction.reply({ content: 'Önce kayıt kanalı ve yeni üye rolünü ayarlayın.', ephemeral: true });
			} else {
				const result = await applyNewMemberRolePermissions(interaction.guild, s.newMemberRoleId, s.channelId);
				await interaction.reply({ content: `İzinler uygulandı. Güncellenen: ${result.updated}, atlanan: ${result.skipped}`, ephemeral: true });
			}
		}
	}

	// Uyarı yönetimi: butonlar
	if (interaction.isButton() && interaction.customId.startsWith('warnadmin:')) {
		if (!interaction.guild || !interaction.member || interaction.user.bot) return;
		const action = interaction.customId.split(':')[1];
		if (action === 'setLogChannel') {
			const channelSelect = new ChannelSelectMenuBuilder()
				.setCustomId('warnadmin:setLogChannel:select')
				.setPlaceholder('System log kanalını seçin');
			const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect);
			await interaction.reply({ content: 'System log kanalını seçin:', components: [row], ephemeral: true });
			return;
		}
		if (action === 'setRoles') {
			const roleSelect = new RoleSelectMenuBuilder()
				.setCustomId('warnadmin:setRoles:select')
				.setPlaceholder('Uyarı atabilecek rolleri seçin')
				.setMinValues(0)
				.setMaxValues(10);
			const row = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleSelect);
			await interaction.reply({ content: 'Uyarı atabilecek rolleri seçin:', components: [row], ephemeral: true });
			return;
		}
		if (action === 'clearAll') {
			const deleted = await clearAllWarns(interaction.guild.id);
			await interaction.reply({ content: `Tüm uyarılar silindi. Etkilenen kayıt sayısı: ${deleted}.`, ephemeral: true });
			return;
		}
	}

	// Uyarı yönetimi: seçim menüleri
	if (interaction.isChannelSelectMenu && interaction.isChannelSelectMenu() && interaction.customId === 'warnadmin:setLogChannel:select') {
		if (!interaction.guild || interaction.user.bot) return;
		const channelId = interaction.values[0];
		await setWarnLogChannel(interaction.guild.id, channelId);
		await interaction.reply({ content: `System log kanalı ayarlandı: <#${channelId}>`, ephemeral: true });
		return;
	}

	if (interaction.isRoleSelectMenu && interaction.isRoleSelectMenu() && interaction.customId === 'warnadmin:setRoles:select') {
		if (!interaction.guild || interaction.user.bot) return;
		const roleIds = interaction.values;
		await setWarnAllowedRoles(interaction.guild.id, roleIds);
		await interaction.reply({ content: `Uyarı atabilecek roller güncellendi: ${roleIds.map((r) => `<@&${r}>`).join(', ') || '—'}`, ephemeral: true });
		return;
	}

	// Uyarı silme seçim menüsü: customId: warnadmin:delete:<USER_ID>
	if (interaction.isStringSelectMenu && interaction.isStringSelectMenu() && interaction.customId.startsWith('warnadmin:delete:')) {
		if (!interaction.guild || interaction.user.bot) return;
		const [, , targetUserId] = interaction.customId.split(':');
		const warnId = interaction.values[0];
		// Silmeden önce kayıt detayını al
		const original = await getWarnById(interaction.guild.id, warnId);
		const ok = await deleteWarn(interaction.guild.id, warnId);
		await interaction.reply({ content: ok ? `Uyarı silindi (#${warnId}).` : 'Silme başarısız.', ephemeral: true });
		// DM ile bilgilendir
		if (ok) {
			try {
				const user = await interaction.client.users.fetch(targetUserId);
				await user.send({ content: `Bir uyarınız silindi. (Sunucu: ${interaction.guild.name}, ID: ${warnId})` });
			} catch {}
			// System log'a bildirim
			try {
				const settings = await getWarnSettings(interaction.guild.id);
				if (settings.logChannelId) {
					const ch = interaction.guild.channels.cache.get(settings.logChannelId) as TextChannel | undefined;
					if (ch) {
						const fields = [
							{ name: 'Kullanıcı', value: `<@${targetUserId}> (${targetUserId})`, inline: true },
							{ name: 'Silen Yetkili', value: `<@${interaction.user.id}>`, inline: true },
							original?.moderator_id ? { name: 'İlk Yetkili', value: `<@${original.moderator_id}>`, inline: true } : { name: '\u200B', value: '\u200B', inline: true },
							{ name: 'Sebep', value: original?.reason || '—', inline: false },
							{ name: 'Warn ID', value: warnId, inline: false },
							original?.created_at ? { name: 'Uyarı Tarihi', value: new Date(original.created_at).toLocaleString(), inline: false } : undefined,
						].filter(Boolean) as any[];
						const embed = buildEmbed({
							title: 'Uyarı Silindi',
							description: `Bir uyarı kaydı silindi.`,
							fields,
							footerText: formatFooter(interaction.guild.name),
							timestamp: true,
							color: 0xef4444,
						});
						try {
							const fetched = await interaction.client.users.fetch(targetUserId);
							const avatarUrl = fetched.displayAvatarURL({ size: 256 });
							(embed as any).setThumbnail?.(avatarUrl);
							if (original?.image_url) (embed as any).setImage?.(original.image_url);
						} catch {}
						await ch.send({ embeds: [embed] });
					}
				}
			} catch {}
		}
		return;
	}

	// Kayıt kanalı seçimi
	if (interaction.isChannelSelectMenu && interaction.isChannelSelectMenu() && interaction.customId === 'regadmin:setChannel:select') {
		if (!interaction.guild || !interaction.channel || interaction.user.bot) return;
		const channelId = interaction.values[0];
		await setRegistrationChannel(interaction.guild.id, channelId);
		const s = await getRegistrationSettings(interaction.guild.id);
		if (s?.newMemberRoleId) {
			const result = await applyNewMemberRolePermissions(interaction.guild, s.newMemberRoleId, channelId);
			await interaction.reply({ content: `Kayıt kanalı ayarlandı: <#${channelId}>. İzinler uyg.: ${result.updated}/${result.skipped}`, ephemeral: true });
		} else {
			await interaction.reply({ content: `Kayıt kanalı ayarlandı: <#${channelId}>. Yeni üye rolü ayarlayınca izinler uygulanacak.`, ephemeral: true });
		}
		addFlowEvent(interaction.channel!.id, 'Kayıt kanalı seçimi tamamlandı.');
	}

	// Kayıt kontrol kanalı seçimi
	if (interaction.isChannelSelectMenu && interaction.isChannelSelectMenu() && interaction.customId === 'regadmin:setReviewChannel:select') {
		if (!interaction.guild || !interaction.channel || interaction.user.bot) return;
		const channelId = interaction.values[0];
		const { setReviewChannel } = await import('./lib/registration');
		const { applyReviewChannelPermissions } = await import('./lib/permissions');
		await setReviewChannel(interaction.guild.id, channelId);
		const s = await getRegistrationSettings(interaction.guild.id);
		await applyReviewChannelPermissions(interaction.guild, channelId, s?.allowedRoleIds ?? []);
		await interaction.reply({ content: `Kayıt kontrol kanalı ayarlandı: <#${channelId}>. Yetkili rollere görünür yapıldı.`, ephemeral: true });
		addFlowEvent(interaction.channel!.id, 'Kayıt kontrol kanalı seçimi tamamlandı.');
	}

	// Modal Yönetimi: Bilgi
	if (interaction.isButton() && interaction.customId === 'regadmin:modal:info') {
		if (!interaction.guild) return;
		const info = [
			'• Yeni alan eklemek için: /modal-icerik-ekle',
			'• Alan silmek için: /modal-icerik-sil',
			'• Alanları listelemek için: /modal-icerik-liste',
			'',
			'Önerilen alanlar:',
			'- ad_soyad (short, zorunlu)',
			'- yas (short, zorunlu, min=1, max=3)',
			'- hakkinda (paragraph, opsiyonel)',
		].join('\n');
		const embed = buildEmbed({ title: 'Modal Oluşturma Rehberi', description: info, color: 0x2b2d31, footerText: formatFooter(interaction.guild.name), timestamp: true });
		if (!interaction.replied && !interaction.deferred) {
			await interaction.reply({ embeds: [embed], ephemeral: true });
		} else {
			await interaction.followUp({ embeds: [embed], ephemeral: true });
		}
		return;
	}

	// Kayıt Yönetimi: Bilgi (kayıt sistemi işleyişi)
	if (interaction.isButton() && interaction.customId === 'regadmin:reg:info') {
		if (!interaction.guild) return;
		const info = [
			'Kayıt Yönetimi:',
			'• Kayıt kanalı: Yeni üyelerin kayıt olacağı kanal. Sadece yeni üye rolü görür.',
			'• Kayıtlı rolü: Onaylanan kullanıcılara verilir.',
			'• Yeni üye rolü: Katılınca verilir; kayıt kanalını görür, diğer kanalları görmez.',
			'• Kayıt kontrol kanalı: Yetkililerin başvuruları onay/ret verdiği kanal.',
			'',
			'İşleyiş:',
			'1) Yeni üye kayıt kanalındaki butonla formu doldurur.',
			'2) Başvuru kontrol kanalına düşer. Yetkili Onay/Reddet butonlarını kullanır.',
			'3) Onay: Kayıtlı rolü verilir, yeni üye rolü kaldırılır. Red: kullanıcı kayıt kanalında kalır.',
		].join('\n');
		const embed = buildEmbed({ title: 'Kayıt Yönetimi Rehberi', description: info, color: 0x2b2d31, footerText: formatFooter(interaction.guild.name), timestamp: true });
		if (!interaction.replied && !interaction.deferred) {
			await interaction.reply({ embeds: [embed], ephemeral: true });
		} else {
			await interaction.followUp({ embeds: [embed], ephemeral: true });
		}
		return;
	}

	// Modal Yönetimi: Yeni Alan Ekle → Modal aç
	if (interaction.isButton() && interaction.customId === 'regadmin:modal:create') {
		if (!interaction.guild) return;
		try {
			const modal = new ModalBuilder().setCustomId('regadmin:modal:create:form').setTitle('Yeni Modal Alanı');
			const inputCustomId = new TextInputBuilder().setCustomId('custom_id').setLabel('Alan Kimliği (ör. ad_soyad)').setStyle(TextInputStyle.Short).setRequired(true);
			const inputLabel = new TextInputBuilder().setCustomId('label').setLabel('Etiket (ör. Ad Soyad)').setStyle(TextInputStyle.Short).setRequired(true);
			const inputStyle = new TextInputBuilder().setCustomId('style').setLabel("Stil (short | paragraph)").setStyle(TextInputStyle.Short).setRequired(true);
			const inputRequired = new TextInputBuilder().setCustomId('required').setLabel('Zorunlu mu? (true|false)').setStyle(TextInputStyle.Short).setRequired(true).setValue('true');
			const inputOrder = new TextInputBuilder().setCustomId('order').setLabel('Sıra (0..N)').setStyle(TextInputStyle.Short).setRequired(false).setValue('0');
			modal.addComponents(
				new ActionRowBuilder<TextInputBuilder>().addComponents(inputCustomId),
				new ActionRowBuilder<TextInputBuilder>().addComponents(inputLabel),
				new ActionRowBuilder<TextInputBuilder>().addComponents(inputStyle),
				new ActionRowBuilder<TextInputBuilder>().addComponents(inputRequired),
				new ActionRowBuilder<TextInputBuilder>().addComponents(inputOrder),
			);
			await interaction.showModal(modal);
		} catch (e) {
			if (!interaction.replied && !interaction.deferred) {
				await interaction.reply({ content: 'Modal açılamadı.', ephemeral: true });
			}
		}
		return;
	}

	// Modal Yönetimi: Alan Sil → Seçim menüsü
	if (interaction.isButton() && interaction.customId === 'regadmin:modal:delete') {
		if (!interaction.guild) return;
		const fields = await listModalFields(interaction.guild.id);
		if (fields.length === 0) {
			const msg = { content: 'Silinecek alan yok.', ephemeral: true as const };
			if (!interaction.replied && !interaction.deferred) { await interaction.reply(msg); } else { await interaction.followUp(msg); }
			return;
		}
		const options = fields.slice(0, 25).map((f) => new StringSelectMenuOptionBuilder().setLabel(`${f.label} (${f.custom_id})`).setValue(f.id));
		const menu = new StringSelectMenuBuilder().setCustomId('regadmin:modal:delete:select').setPlaceholder('Silinecek alanı seçin').addOptions(options);
		const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
		if (!interaction.replied && !interaction.deferred) { await interaction.reply({ content: 'Silinecek alanı seçin:', components: [row], ephemeral: true }); } else { await interaction.followUp({ content: 'Silinecek alanı seçin:', components: [row], ephemeral: true }); }
		return;
	}

	// Modal Yönetimi: Yeni Alan Ekle — submit
	if (interaction.isModalSubmit() && interaction.customId === 'regadmin:modal:create:form') {
		if (!interaction.guild) return;
		try {
			const custom_id = interaction.fields.getTextInputValue('custom_id').trim();
			const label = interaction.fields.getTextInputValue('label').trim();
			const styleRaw = interaction.fields.getTextInputValue('style').trim().toLowerCase();
			const style = (styleRaw === 'paragraph' ? 'paragraph' : 'short') as 'short' | 'paragraph';
			const required = (interaction.fields.getTextInputValue('required').trim().toLowerCase() === 'true');
			const orderNum = Number(interaction.fields.getTextInputValue('order').trim() || '0');
			await addModalField(interaction.guild.id, { custom_id, label, style, required, placeholder: null, min_length: null, max_length: null, order: isNaN(orderNum) ? 0 : orderNum });
			await interaction.reply({ content: `Alan eklendi: ${label} (${custom_id})`, ephemeral: true });
			// Güncel listeyi göster
			const fields = await listModalFields(interaction.guild.id);
			const infoBtn = new ButtonBuilder().setCustomId('regadmin:modal:info').setLabel('Bilgi').setStyle(ButtonStyle.Secondary);
			const createBtn = new ButtonBuilder().setCustomId('regadmin:modal:create').setLabel('Yeni Alan Ekle').setStyle(ButtonStyle.Success);
			const deleteBtn = new ButtonBuilder().setCustomId('regadmin:modal:delete').setLabel('Alan Sil').setStyle(ButtonStyle.Danger);
			const row = new ActionRowBuilder<ButtonBuilder>().addComponents(createBtn, deleteBtn);
			const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(infoBtn);
			const lines = fields.length ? fields.map((f, i) => `${i + 1}. [${f.id}] ${f.label} (${f.custom_id}) • ${f.style} ${f.required ? 'Z' : ''} sira:${f.order}`).join('\n') : 'Henüz alan yok.';
			const embed = buildEmbed({ title: 'Kayıt Modal Yönetimi', description: lines, color: 0x3b82f6, footerText: formatFooter(interaction.guild.name), timestamp: true });
			await interaction.followUp({ embeds: [embed], components: [row, row2], ephemeral: true });
		} catch (e) {
			if (!interaction.replied && !interaction.deferred) {
				await interaction.reply({ content: 'Alan eklenemedi.', ephemeral: true });
			}
		}
		return;
	}

	// Modal Yönetimi: Alan Sil — seçimi işle
	if (interaction.isStringSelectMenu && interaction.isStringSelectMenu() && interaction.customId === 'regadmin:modal:delete:select') {
		if (!interaction.guild) return;
		const id = interaction.values[0];
		const ok = await deleteModalField(interaction.guild.id, id);
		if (!interaction.replied && !interaction.deferred) {
			await interaction.reply({ content: ok ? 'Alan silindi.' : 'Silme başarısız.', ephemeral: true });
		} else {
			await interaction.followUp({ content: ok ? 'Alan silindi.' : 'Silme başarısız.', ephemeral: true });
		}
		// Güncel liste
		const fields = await listModalFields(interaction.guild.id);
		const infoBtn = new ButtonBuilder().setCustomId('regadmin:modal:info').setLabel('Bilgi').setStyle(ButtonStyle.Secondary);
		const createBtn = new ButtonBuilder().setCustomId('regadmin:modal:create').setLabel('Yeni Alan Ekle').setStyle(ButtonStyle.Success);
		const deleteBtn = new ButtonBuilder().setCustomId('regadmin:modal:delete').setLabel('Alan Sil').setStyle(ButtonStyle.Danger);
		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(createBtn, deleteBtn);
		const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(infoBtn);
		const lines = fields.length ? fields.map((f, i) => `${i + 1}. [${f.id}] ${f.label} (${f.custom_id}) • ${f.style} ${f.required ? 'Z' : ''} sira:${f.order}`).join('\n') : 'Henüz alan yok.';
		const embed = buildEmbed({ title: 'Kayıt Modal Yönetimi', description: lines, color: 0x3b82f6, footerText: formatFooter(interaction.guild.name), timestamp: true });
		await interaction.followUp({ embeds: [embed], components: [row, row2], ephemeral: true });
		return;
	}


	// Kayıt rolü seçimi
	if (interaction.isRoleSelectMenu && interaction.isRoleSelectMenu() && interaction.customId === 'regadmin:setRole:select') {
		if (!interaction.guild || !interaction.channel || interaction.user.bot) return;
		const roleId = interaction.values[0];
		await setRegisteredRole(interaction.guild.id, roleId);
		await interaction.reply({ content: `Kayıt rolü başarıyla ayarlandı: <@&${roleId}>`, ephemeral: true });
		addFlowEvent(interaction.channel!.id, 'Kayıt rolü seçimi tamamlandı.');
	}

	// Yeni üye rolü seçimi
	if (interaction.isRoleSelectMenu && interaction.isRoleSelectMenu() && interaction.customId === 'regadmin:setNewMemberRole:select') {
		if (!interaction.guild || !interaction.channel || interaction.user.bot) return;
		const roleId = interaction.values[0];
		await setNewMemberRole(interaction.guild.id, roleId);
		const s = await getRegistrationSettings(interaction.guild.id);
		if (s?.channelId) {
			const result = await applyNewMemberRolePermissions(interaction.guild, roleId, s.channelId);
			await interaction.reply({ content: `Yeni üye rolü ayarlandı: <@&${roleId}>. İzinler uyg.: ${result.updated}/${result.skipped}`, ephemeral: true });
		} else {
			await interaction.reply({ content: `Yeni üye rolü ayarlandı: <@&${roleId}>. Kayıt kanalı ayarlandığında izinler uygulanacak.`, ephemeral: true });
		}
		addFlowEvent(interaction.channel!.id, 'Yeni üye rolü seçimi tamamlandı.');
	}
});

client.login(appConfig.discordToken);


