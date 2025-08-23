import { Client, Collection, Events, GatewayIntentBits, Interaction, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { config as appConfig } from './config';
import { commands } from './commands';
import { deployCommands } from './lib/deployCommands';
import { createTicketChannel, extractSupportRoleIdFromTopic } from './lib/tickets';
import { findFaq } from './lib/faq';
import { buildEmbed, formatFooter, setBrandAssets } from './lib/ui';
import { ensureSchema } from './lib/db';
import { ensureLogChannel, exportChannelTranscript, postClosureSummary } from './lib/logs';
import { addFlowEvent, getAndClearFlowEvents } from './lib/flow';
import { setWarnLogChannel, setWarnAllowedRoles, clearAllWarns, deleteWarn, getWarnById, getWarnSettings } from './lib/warn';
import { buildRegistrationModal, getRegistrationSettings, listModalFields, saveSubmission, setRegistrationChannel, setRegisteredRole, addModalField, deleteModalField, setNewMemberRole, approveSubmission, rejectSubmission } from './lib/registration';
import { getLevelSettings, resetAllLevels, setLevelAnnounceChannel, setLevelEnabled } from './lib/levels';
import { applyNewMemberRolePermissions } from './lib/permissions';
import { getWordle, guessWord, renderBoard, toContextId, normalizeTR } from './lib/wordle';
import { getTttContextId, getTtt, startTtt, makeMove } from './lib/tictactoe';
import { getRpsContextId, startRps, getRpsByToken, submitChoice, setRpsMessageId } from './lib/rps';
import { renderRps } from './lib/rpsImage';
import { renderTtt } from './lib/tictactoeImage';
import { renderBoardPng } from './lib/wordleImage';
import { awardMessageXp } from './lib/levels';

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
		try {
			setBrandAssets({
				name: c.user.username || 'ZoKo',
				iconUrl: c.user.displayAvatarURL({ size: 256 }),
				url: 'https://discord.com',
			});
		} catch {}
		await ensureSchema();
		await deployCommands();
		console.log(`📝 Slash komutları otomatik dağıtıldı (${commands.length})`);
		for (let index = 0; index < commands.length; index++) {
			const command = commands[index];
			try {
				if (!command.data || !command.execute) {
					console.error(`❌ ${command.data?.name || 'İsimsiz komut'} komutunda eksik özellikler var!`);
					continue;
				}
				
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
		const btn = new ButtonBuilder().setCustomId('reg:open').setLabel('Kayıt Ol').setEmoji('📝').setStyle(ButtonStyle.Primary);
		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(btn);
		await channel.send({ content: `${member}`, embeds: [embed], components: [row] });
	} catch (e) {
		console.error('Kayıt mesajı gönderilemedi:', e);
	}
});

client.on(Events.InteractionCreate, async (interaction) => {
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

	// Kullanıcı bağlam menüsü komutları (sağ tık → Uygulamalar → Kullanıcı)
	if (interaction.isUserContextMenuCommand && interaction.isUserContextMenuCommand()) {
		const name = interaction.commandName;
		const handler = commandMap.get(name);
		if (!handler) {
			await interaction.reply({ content: 'Komut bulunamadı.', ephemeral: true });
			return;
		}
		try {
			await handler(interaction as any);
		} catch (error) {
			console.error('Bağlam menüsü komut hatası:', error);
			if (interaction.deferred || interaction.replied) {
				await interaction.followUp({ content: 'Bir hata oluştu.', ephemeral: true });
			} else {
				await interaction.reply({ content: 'Bir hata oluştu.', ephemeral: true });
			}
		}
		return;
	}

	if (interaction.isButton() && interaction.customId.startsWith('bj:')) {
		const channelId = interaction.channelId;
		const guildId = interaction.guild?.id ?? null;
		const ctx = `${guildId ?? 'dm'}:${channelId}:${interaction.user.id}`;
		const action = interaction.customId.split(':')[1];
		try {
			const { getBlackjack } = await import('./lib/blackjack');
			if (!getBlackjack(ctx)) {
				const { startBlackjack } = await import('./lib/blackjack');
				startBlackjack(ctx);
			}
			if (action === 'hit') {
				const { hitBlackjack } = await import('./lib/blackjack');
				hitBlackjack(ctx);
			}
			if (action === 'stand') {
			}
			if (action === 'reset') {
				const { resetBlackjack, startBlackjack } = await import('./lib/blackjack');
				resetBlackjack(ctx);
				startBlackjack(ctx);
			}
			const { renderBlackjack } = await import('./lib/blackjackImage');
			const state = (await import('./lib/blackjack')).getBlackjack(ctx)!;
			const img = await renderBlackjack(state, { revealDealerHole: action === 'stand' });
			const embed = (await import('./lib/ui')).buildEmbed({
				title: '♠️ Blackjack',
				description: state.finished ? (state.result === 'player' ? '🎉 Kazandın!' : state.result === 'dealer' ? '❌ Kaybettin.' : '🤝 Berabere.') : 'Kart çekmek için "Çek"e, durmak için "Dur"a bas.',
				imageUrl: `attachment://${img.fileName}`,
				footerText: (await import('./lib/ui')).formatFooter(interaction.guild?.name || 'ZoKo'),
				timestamp: true,
				color: state.finished ? (state.result === 'player' ? 0x22c55e : state.result === 'dealer' ? 0xef4444 : 0xf59e0b) : 0x111827,
			});
			const hitBtn = new ButtonBuilder().setCustomId('bj:hit').setLabel('Çek').setEmoji('🃏').setStyle(ButtonStyle.Primary).setDisabled(state.finished || action === 'stand');
			const standBtn = new ButtonBuilder().setCustomId('bj:stand').setLabel('Dur').setEmoji('✋').setStyle(ButtonStyle.Secondary).setDisabled(state.finished || action === 'stand');
			const resetBtn = new ButtonBuilder().setCustomId('bj:reset').setLabel('Yeniden').setEmoji('🔁').setStyle(ButtonStyle.Success).setDisabled(!state.finished);
			const row = new ActionRowBuilder<ButtonBuilder>().addComponents(hitBtn, standBtn, resetBtn);
			await interaction.update({ embeds: [embed], files: [{ attachment: img.buffer, name: img.fileName }], components: [row] });

			if (action === 'stand') {
				try {
					const { dealerStep, getBlackjack } = await import('./lib/blackjack');
					while (true) {
						const step = dealerStep(ctx);
						const st = getBlackjack(ctx)!;
						const imgStep = await renderBlackjack(st, { revealDealerHole: true });
						const ui = await import('./lib/ui');
						const embedStep = ui.buildEmbed({
							title: '♠️ Blackjack',
							description: st.finished ? (st.result === 'player' ? '🎉 Kazandın!' : st.result === 'dealer' ? '❌ Kaybettin.' : '🤝 Berabere.') : 'Krupiye kart çekiyor…',
							imageUrl: `attachment://${imgStep.fileName}`,
							footerText: ui.formatFooter(interaction.guild?.name || 'ZoKo'),
							timestamp: true,
							color: st.finished ? (st.result === 'player' ? 0x22c55e : st.result === 'dealer' ? 0xef4444 : 0xf59e0b) : 0x111827,
						});
						const hitBtnD = new ButtonBuilder().setCustomId('bj:hit').setLabel('Çek').setEmoji('🃏').setStyle(ButtonStyle.Primary).setDisabled(true);
						const standBtnD = new ButtonBuilder().setCustomId('bj:stand').setLabel('Dur').setEmoji('✋').setStyle(ButtonStyle.Secondary).setDisabled(true);
						const resetBtnD = new ButtonBuilder().setCustomId('bj:reset').setLabel('Yeniden').setEmoji('🔁').setStyle(ButtonStyle.Success).setDisabled(!st.finished);
						const rowD = new ActionRowBuilder<ButtonBuilder>().addComponents(hitBtnD, standBtnD, resetBtnD);
						await interaction.editReply({ embeds: [embedStep], files: [{ attachment: imgStep.buffer, name: imgStep.fileName }], components: [rowD] });
						if (step.done) break;
						await new Promise((r) => setTimeout(r, 900));
					}
				} catch {}
			}
		} catch (e) {
			console.error('Blackjack buton hatası:', e);
			if (!interaction.replied && !interaction.deferred) {
				await interaction.reply({ content: 'İşlem yapılamadı.', ephemeral: true });
			}
		}
		return;
	}

	// TKM: davet
	if (interaction.isButton() && interaction.customId.startsWith('tkm:invite:')) {
		if (!interaction.guild || interaction.user.bot) return;
		const [, , choice, token, playerXId, playerOId, bestOfRaw] = interaction.customId.split(':');
		if (interaction.user.id !== playerOId) { await interaction.reply({ content: 'Bu davet sana ait değil.', ephemeral: true }); return; }
		if (choice === 'no') { await interaction.update({ content: 'Davet reddedildi.', components: [], embeds: [] }); return; }
		const ctx = getRpsContextId(interaction.guild.id, interaction.channelId);
		const state = startRps(ctx, playerXId, playerOId, (Number(bestOfRaw) as any) || 3, token);
		const pX = await interaction.client.users.fetch(playerXId);
		const pO = await interaction.client.users.fetch(playerOId);
		const img = await renderRps(state, {
			playerX: { name: pX.username, avatarUrl: pX.displayAvatarURL({ size: 128, extension: 'png' }) },
			playerO: { name: pO.username, avatarUrl: pO.displayAvatarURL({ size: 128, extension: 'png' }) },
		});
		const embed = (await import('./lib/ui')).buildEmbed({ title: 'Taş • Kağıt • Makas', imageUrl: `attachment://${img.fileName}`, footerText: (await import('./lib/ui')).formatFooter(interaction.guild.name), timestamp: true });
		const { choiceRow } = await import('./commands/tkm');
		const openRow = choiceRow(token);
		try {
			await interaction.update({ content: 'Kabul edildi. Oyun başlıyor…', embeds: [], components: [] });
		} catch {}
		try {
			const ch: any = interaction.channel as any;
			if (ch && typeof ch.send === 'function') {
				const sent = await ch.send({ embeds: [embed], files: [{ attachment: img.buffer, name: img.fileName }], components: [openRow] });
				setRpsMessageId(token, (sent as any).id);
			}
		} catch {}
		// Artık seçim butonları ana oyun mesajında
		return;
	}
	// TKM: sohbetten seçim butonu açma (X/O kendi seçim menüsünü görür)
	if (interaction.isButton() && interaction.customId.startsWith('tkm:open:')) {
		const [, , token, role] = interaction.customId.split(':');
		const state = getRpsByToken(token);
		if (!state) { await interaction.reply({ content: 'Oyun bulunamadı.', ephemeral: true }); return; }
		const isX = role === 'X';
		const mustId = isX ? state.playerXId : state.playerOId;
		if (interaction.user.id !== mustId) { await interaction.reply({ content: 'Bu buton sana ait değil.', ephemeral: true }); return; }
		const { choiceRow, openChoiceRow } = await import('./commands/tkm');
		const rowChoices = choiceRow(token);
		await interaction.reply({ content: 'Seçimini yap:', components: [rowChoices], ephemeral: true });
		// Açık kontrol butonlarını ilgili taraf için kapat
		try {
			const rowOpen = openChoiceRow(token, isX ? false : true, isX ? true : false);
			await interaction.message.edit({ components: [rowOpen] as any });
		} catch {}
		return;
	}

	// TKM: seçim
	if (interaction.isButton() && interaction.customId.startsWith('tkm:choose:')) {
		const [, , token, pick] = interaction.customId.split(':');
		const res = submitChoice(token, interaction.user.id, pick as any);
		if (res.error) { await interaction.reply({ content: res.error, ephemeral: true }); return; }
		// Sohbette görünür bilgilendirme: kim seçimini yaptı
		try {
			const state = res.state!;
			const ch: any = interaction.channel as any;
			if (ch && typeof ch.send === 'function') {
				const sent = await ch.send({ content: `<@${interaction.user.id}> seçimini yaptı.` });
				if (interaction.user.id === state.playerXId) state.selectMsgIdX = sent.id; else state.selectMsgIdO = sent.id;
			}
		} catch {}
		// Ephemeral cevap yerine görünür mesaj kullandık
		if (!res.resultReady) return;
		// Sonuç hazır → public mesajı güncelle
		const state = res.state!;
		const pX = await interaction.client.users.fetch(state.playerXId).catch(() => null as any);
		const pOUser = state.versusBot && state.playerOId === 'bot' ? null : await interaction.client.users.fetch(state.playerOId).catch(() => null as any);
		const img = await renderRps(state, {
			playerX: { name: pX?.username ?? 'X', avatarUrl: pX?.displayAvatarURL({ size: 128, extension: 'png' }) },
			playerO: state.versusBot ? { name: 'Bot', avatarUrl: interaction.client.user?.displayAvatarURL({ size: 128, extension: 'png' }) ?? undefined } : { name: pOUser?.username ?? 'O', avatarUrl: pOUser?.displayAvatarURL({ size: 128, extension: 'png' }) },
		});
		const embed = (await import('./lib/ui')).buildEmbed({ title: 'Taş • Kağıt • Makas', imageUrl: `attachment://${img.fileName}`, footerText: (await import('./lib/ui')).formatFooter(interaction.guild?.name || ''), timestamp: true });
		const { choiceRow } = await import('./commands/tkm');
		const componentsNext = state.finished ? [] : [choiceRow(state.token)] as any;
		try {
			// Oyun kanalındaki ana mesajı editle
			const ch: any = interaction.channel as any;
			if (state.messageId && ch && ch.messages?.fetch) {
				const msg = await ch.messages.fetch(state.messageId).catch(() => null as any);
				if (msg) await msg.edit({ embeds: [embed], files: [{ attachment: img.buffer, name: img.fileName }], components: componentsNext });
			}
			// Seçim yapıldı mesajlarını temizle
			try {
				if (state.selectMsgIdX) await ch.messages?.delete?.(state.selectMsgIdX).catch(() => {});
				if (state.selectMsgIdO) await ch.messages?.delete?.(state.selectMsgIdO).catch(() => {});
				state.selectMsgIdX = null; state.selectMsgIdO = null;
			} catch {}
		} catch {}
		return;
	}

	// XOX: davet akışı
	if (interaction.isButton() && interaction.customId.startsWith('xox:invite:')) {
		if (!interaction.guild || interaction.user.bot) return;
		const [, , choice, playerXId, playerOId] = interaction.customId.split(':');
		if (interaction.user.id !== playerOId) {
			await interaction.reply({ content: 'Bu davet sana ait değil.', ephemeral: true });
			return;
		}
		if (choice === 'no') {
			await interaction.update({ content: 'Davet reddedildi.', embeds: [], components: [] });
			return;
		}
		// Evet → oyunu başlat
		const ctx = getTttContextId(interaction.guild.id, interaction.channelId);
		const state = startTtt(ctx, playerXId, playerOId, false);
		const pX = await interaction.client.users.fetch(playerXId);
		const pO = await interaction.client.users.fetch(playerOId);
		const img = await renderTtt(state, {
			playerX: { name: pX.username, avatarUrl: pX.displayAvatarURL({ size: 128, extension: 'png' }) },
			playerO: { name: pO.username, avatarUrl: pO.displayAvatarURL({ size: 128, extension: 'png' }) },
		});
		const { buildEmbed, formatFooter } = await import('./lib/ui');
		const embed = buildEmbed({ title: 'X-O-X', description: `Rakipler: <@${playerXId}> (X) vs <@${playerOId}> (O)`, imageUrl: `attachment://${img.fileName}`, footerText: formatFooter(interaction.guild.name), timestamp: true });
		const { buildGridRows } = await import('./commands/xox');
		const rows = buildGridRows(state);
		await interaction.update({ content: '', embeds: [embed], files: [{ attachment: img.buffer, name: img.fileName }], components: rows });
		return;
	}

	// XOX: hamleler
	if (interaction.isButton() && interaction.customId.startsWith('xox:move:')) {
		if (!interaction.guild || interaction.user.bot) return;
		const index = Number(interaction.customId.split(':')[2] || '-1');
		const ctx = getTttContextId(interaction.guild.id, interaction.channelId);
		const before = getTtt(ctx);
		if (!before) {
			await interaction.reply({ content: 'Bu kanalda aktif X-O-X yok. /xox ile başlatın.', ephemeral: true });
			return;
		}
		const res = makeMove(ctx, interaction.user.id, index);
		if (res.error) {
			await interaction.reply({ content: res.error, ephemeral: true });
			return;
		}
		const state = res.state!;
		const pX = await interaction.client.users.fetch(state.playerXId).catch(() => null as any);
		const pO = state.versusBot && state.playerOId === 'bot' ? null : await interaction.client.users.fetch(state.playerOId).catch(() => null as any);
		const img = await renderTtt(state, {
			lastMoveIndex: index,
			playerX: { name: pX?.username ?? 'Oyuncu X', avatarUrl: pX?.displayAvatarURL({ size: 128, extension: 'png' }) },
			playerO: state.versusBot && state.playerOId === 'bot'
				? { name: 'Bot', avatarUrl: interaction.client.user?.displayAvatarURL({ size: 128, extension: 'png' }) ?? undefined }
				: { name: pO?.username ?? 'Oyuncu O', avatarUrl: pO?.displayAvatarURL({ size: 128, extension: 'png' }) },
		});
		const { buildEmbed, formatFooter } = await import('./lib/ui');
		const title = 'X-O-X';
		const desc = state.finished ? (state.winner === 'tie' ? '🤝 Berabere.' : (state.winner === 'X' ? `🎉 <@${state.playerXId}> kazandı!` : `🎉 <@${state.playerOId}> kazandı!`)) : `Sıra: ${state.turn}`;
		const embed = buildEmbed({ title, description: desc, imageUrl: `attachment://${img.fileName}`, footerText: formatFooter(interaction.guild.name), timestamp: true });
		const { buildGridRows } = await import('./commands/xox');
		const rows = buildGridRows(state);
		try {
			await interaction.update({ embeds: [embed], files: [{ attachment: img.buffer, name: img.fileName }], components: rows });
		} catch {
			await interaction.reply({ embeds: [embed], files: [{ attachment: img.buffer, name: img.fileName }], components: rows });
		}
		return;
	}

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

	if (interaction.isButton() && interaction.customId.startsWith('help:cat:')) {
		const category = interaction.customId.split(':')[2] || 'tum';
		const commandCategoryByName: Record<string, 'genel' | 'destek' | 'kayit' | 'uyari' | 'seviye' | 'oyun' | 'owner'> = {
			ping: 'genel',
			hello: 'genel',
			profil: 'genel',
			avatar: 'genel',
			'sunucu-bilgi': 'genel',
			'bot-bilgi': 'genel',
			'destek-olustur': 'destek',
			'destek-sil': 'destek',
			'destek-soru-olustur': 'destek',
			'destek-soru-duzenle': 'destek',
			'destek-soru-sil': 'destek',
			'ticket-kapa': 'destek',
			'kayit-ayar-roller': 'kayit',
			'kayit-yonetim': 'kayit',
			'uyari-yonetim': 'uyari',
			'uyari-ver': 'uyari',
			'uyari-sil': 'uyari',
			'uyari-liste': 'uyari',
			seviye: 'seviye',
			'seviye-yonetim': 'seviye',
			'seviye-liderlik': 'seviye',
			wordle: 'oyun',
			xox: 'oyun',
			tkm: 'oyun',
			'ask-olcer': 'oyun',
			'owner-send': 'owner',
			'owner-restart': 'owner',
			'owner-activity': 'owner',
			'mute': 'uyari',
			'unmute': 'uyari',
			'kick': 'uyari',
			'ban': 'uyari',
			'clear': 'uyari',
		};

		const items = commands
			.filter((c) => category === 'tum' ? true : commandCategoryByName[c.data.name as keyof typeof commandCategoryByName] === category)
			.map((c) => ({ name: c.data.name, description: c.data.description || '—' }));

		const titleByCat: Record<string, string> = {
			'tum': 'Tüm Komutlar',
			'genel': 'Genel',
			'destek': 'Destek',
			'kayit': 'Kayıt',
			'uyari': 'Uyarı',
			'seviye': 'Seviye',
			'oyun': 'Oyun',
			'owner': 'Sahip',
		};

		const description = items.length
			? items.map((i) => `• /${i.name} — ${i.description}`).join('\n')
			: 'Bu kategoride komut yok.';

		const embed = buildEmbed({
			title: `Yardım • ${titleByCat[category] ?? 'Tümü'}`,
			description,
			color: 0x5865f2,
			footerText: formatFooter(interaction.guild?.name || 'ZoKo'),
			timestamp: true,
		});

		const categories = [
			{ id: 'tum', label: 'Tümü', emoji: '📖' },
			{ id: 'genel', label: 'Genel', emoji: '🧭' },
			{ id: 'destek', label: 'Destek', emoji: '🎫' },
			{ id: 'kayit', label: 'Kayıt', emoji: '📝' },
			{ id: 'uyari', label: 'Uyarı', emoji: '⚠️' },
			{ id: 'seviye', label: 'Seviye', emoji: '🏆' },
			{ id: 'oyun', label: 'Oyun', emoji: '🎮' },
			{ id: 'owner', label: 'Sahip', emoji: '👑' },
		];
		const buttons = categories.map((c) => new ButtonBuilder()
			.setCustomId(`help:cat:${c.id}`)
			.setLabel(c.label)
			.setEmoji(c.emoji)
			.setStyle((c.id === category ? ButtonStyle.Primary : ButtonStyle.Secondary))
		);
		const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(0, 5));
		const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(5));

		try {
			await interaction.update({ embeds: [embed], components: [row1, row2] });
		} catch {
			if (!interaction.replied && !interaction.deferred) {
				await interaction.reply({ embeds: [embed], components: [row1, row2], ephemeral: true });
			}
		}
		return;
	}

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
			const confirmEmbed = buildEmbed({
				title: 'Kayıt Başvurusu Alındı',
				description: 'Başvurun incelemeye gönderildi. Onaylandığında bilgilendirileceksin.',
				color: 0x38bdf8,
				footerText: formatFooter(interaction.guild.name),
				timestamp: true,
			});
			await interaction.reply({ embeds: [confirmEmbed], ephemeral: true });
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
					const approveBtn = new ButtonBuilder().setCustomId(`regreview:approve:${submissionId}`).setLabel('Onayla').setEmoji('✅').setStyle(ButtonStyle.Success);
					const rejectBtn = new ButtonBuilder().setCustomId(`regreview:reject:${submissionId}`).setLabel('Reddet').setEmoji('❌').setStyle(ButtonStyle.Danger);
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
			try {
				if (settings?.registeredRoleId) {
					const member = await interaction.guild.members.fetch((interaction.message.embeds[0]?.description || '').match(/<@([0-9]+)>/)?.[1] || '');
					await member.roles.add(settings.registeredRoleId).catch(() => {});
					if (settings.newMemberRoleId) await member.roles.remove(settings.newMemberRoleId).catch(() => {});
					await member.send({ embeds: [buildEmbed({ title: 'Kayıt Onaylandı', description: `${interaction.guild.name} sunucusunda kaydın onaylandı. Keyifli sohbetler!`, color: 0x22c55e })] }).catch(() => {});
				}
			} catch {}
			try {
				const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder().setCustomId('disabled-approve').setLabel('Onaylandı').setEmoji('✅').setStyle(ButtonStyle.Success).setDisabled(true),
					new ButtonBuilder().setCustomId('disabled-reject').setLabel('Reddedildi').setEmoji('❌').setStyle(ButtonStyle.Danger).setDisabled(true),
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
			try {
				const memberId = (interaction.message.embeds[0]?.description || '').match(/<@([0-9]+)>/)?.[1];
				if (memberId) {
					const member = await interaction.guild.members.fetch(memberId);
					await member.send({ embeds: [buildEmbed({ title: 'Kayıt Reddedildi', description: `${interaction.guild.name} sunucusunda kaydın şimdilik onaylanmadı. Lütfen kayıt kanalındaki yönergeleri takip et.`, color: 0xef4444 })] }).catch(() => {});
				}
			} catch {}
			try {
				const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder().setCustomId('disabled-approve').setLabel('Onaylandı').setEmoji('✅').setStyle(ButtonStyle.Success).setDisabled(true),
					new ButtonBuilder().setCustomId('disabled-reject').setLabel('Reddedildi').setEmoji('❌').setStyle(ButtonStyle.Danger).setDisabled(true),
				);
				await interaction.message.edit({ components: [row] });
			} catch {}
			await interaction.reply({ content: 'Başvuru reddedildi.', ephemeral: true });
			return;
		}
	}

	if (interaction.isButton() && interaction.customId.startsWith('ticket:create')) {
		if (!interaction.guild || !interaction.member || interaction.user.bot) return;
		try {
			const parts = interaction.customId.split(':');
			const supportRoleId = parts[2] || undefined;
			const channel = await createTicketChannel(interaction.member as any, supportRoleId);
			await channel.send(`Merhaba ${interaction.user}, talebiniz alındı. Aşağıdaki seçeneklerden ihtiyacınıza uygun olanı seçiniz.`);
			addFlowEvent(channel.id, 'Ticket açıldı ve kullanıcı bilgilendirildi.');
			await (await import('./lib/faq')).sendFaqMenu(channel, interaction.guild.id);
			setTimeout(async () => {
				try {
					const confirmEmbed = buildEmbed({
						title: 'Onay',
						description: 'Anlaşıldı mı?',
						color: 0x38bdf8,
						footerText: formatFooter(interaction.guild!.name),
						timestamp: true,
					});
					const yesBtn = new ButtonBuilder().setCustomId('ticket:confirm:yes').setLabel('Evet').setEmoji('✅').setStyle(ButtonStyle.Success);
					const noBtn = new ButtonBuilder().setCustomId('ticket:confirm:no').setLabel('Hayır').setEmoji('❌').setStyle(ButtonStyle.Danger);
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
			const yesBtn = new ButtonBuilder().setCustomId('ticket:live:yes').setLabel('Evet').setEmoji('📞').setStyle(ButtonStyle.Primary);
			const noBtn = new ButtonBuilder().setCustomId('ticket:live:no').setLabel('Hayır').setEmoji('🛑').setStyle(ButtonStyle.Secondary);
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

	// Seviye yönetimi butonları
	if (interaction.isButton() && interaction.customId.startsWith('lvladmin:')) {
		if (!interaction.guild || !interaction.member || interaction.user.bot) return;
		const action = interaction.customId.split(':')[1];
		if (action === 'toggle') {
			const s = await getLevelSettings(interaction.guild.id);
			await setLevelEnabled(interaction.guild.id, !s.enabled);
			await interaction.reply({ content: `Seviye sistemi ${!s.enabled ? 'açıldı' : 'kapatıldı'}.`, ephemeral: true });
			return;
		}
		if (action === 'setChannel') {
			const channelSelect = new ChannelSelectMenuBuilder()
				.setCustomId('lvladmin:setChannel:select')
				.setPlaceholder('Seviye mesajlarının gönderileceği kanalı seçin (boş bırakmak için iptal edin)');
			const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect);
			await interaction.reply({ content: 'Seviye kanalını seçin:', components: [row], ephemeral: true });
			return;
		}
		if (action === 'resetAll') {
			const affected = await resetAllLevels(interaction.guild.id);
			await interaction.reply({ content: `Tüm seviyeler sıfırlandı. Etkilenen kayıt: ${affected}`, ephemeral: true });
			return;
		}
	}

	// Seviye kanalı seçimi
	if (interaction.isChannelSelectMenu && interaction.isChannelSelectMenu() && interaction.customId === 'lvladmin:setChannel:select') {
		if (!interaction.guild || interaction.user.bot) return;
		const channelId = interaction.values[0];
		await setLevelAnnounceChannel(interaction.guild.id, channelId);
		await interaction.reply({ content: `Seviye bildirim kanalı ayarlandı: <#${channelId}>`, ephemeral: true });
		return;
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

// Wordle: mesajları otomatik tahmin olarak alma
client.on(Events.MessageCreate as any, async (message: any) => {
	try {
		if (!message || message.author?.bot) return;
		const channelId = message.channel?.id;
		if (!channelId) return;
		const contentRaw = String(message.content || '').trim();

		// --- Seviye: mesajdan XP kazanımı ---
		if (message.guild) {
			try {
				const settings = await getLevelSettings(message.guild.id);
				const result = await awardMessageXp(message.guild.id, message.author.id, contentRaw, settings);
				if (result.awarded && result.levelUp && !result.silent) {
					// Duyuru kanalını seç; yoksa konuşulan kanala gönder
					const channelToAnnounce = settings.announceChannelId
						? (await message.guild.channels.fetch(settings.announceChannelId).catch(() => null))
						: message.channel;
					const targetChannel = (channelToAnnounce && 'send' in channelToAnnounce) ? channelToAnnounce : message.channel;
					await (targetChannel as any).send({ content: `🎉 Tebrikler <@${message.author.id}>! Seviye ${result.level} oldun.`, allowedMentions: { users: [message.author.id] } });
				}
			} catch {}
		}

		const ctx = toContextId(message.guild?.id ?? null, channelId);
		const state = getWordle(ctx);
		if (!state || state.finished) return;
		if (!contentRaw) return;
		const content = normalizeTR(contentRaw);
		// Sadece hedef uzunlukta ve harflerden oluşan girişleri kabul et
		const trLetters = /^[a-zçğıöşü]+$/i;
		if (content.length !== state.length || !trLetters.test(content)) return;
		const { state: updated } = guessWord(ctx, content);
		if (!updated) return;
		const img = await renderBoardPng(updated);
		const embed = buildEmbed({
			title: `Wordle-TR • ${updated.length} harf • ${updated.maxAttempts} hak` + (updated.finished ? ' • Oyun Bitti' : ''),
			description: updated.finished ? (updated.success ? '🎉 Tebrikler!' : `❌ Bitti. Doğru kelime: ${updated.target.toUpperCase()}`) : undefined,
			footerText: formatFooter(message.guild?.name ?? ''),
			timestamp: true,
			imageUrl: `attachment://${img.fileName}`,
		});
		try {
			const ch: any = message.channel as any;
			const msgId = updated.messageId;
			if (msgId && ch?.messages?.fetch) {
				const msg = await ch.messages.fetch(msgId).catch(() => null as any);
				if (msg) {
					await msg.edit({ embeds: [embed], files: [{ attachment: img.buffer, name: img.fileName }] });
					// Kullanıcı tahmin mesajını sil
					try { if ((message as any).deletable) await message.delete(); } catch {}
					return;
				}
			}
			// İlk kez ise oluştur ve id'yi kaydet
			const sent = await ch.send({ embeds: [embed], files: [{ attachment: img.buffer, name: img.fileName }] });
			updated.messageId = (sent as any).id;
			try { if ((message as any).deletable) await message.delete(); } catch {}
		} catch {}
	} catch (e) {
		console.error('Wordle mesaj işleme hatası:', e);
	}
});

client.login(appConfig.discordToken);

