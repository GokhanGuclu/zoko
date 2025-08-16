import { REST, Routes } from 'discord.js';
import { config as appConfig } from '../config';
import { commands } from '../commands';

export async function deployCommands(): Promise<void> {
	const rest = new REST({ version: '10' }).setToken(appConfig.discordToken);
	const body = commands.map((c) => c.data.toJSON());

	if (appConfig.guildId) {
		// Geliştirme/tek sunucu testi için hızlı dağıtım
		await rest.put(
			Routes.applicationGuildCommands(appConfig.clientId, appConfig.guildId),
			{ body }
		);
		return;
	}

	// Genel (global) dağıtım — tüm sunuculara yayılır (Discord tarafında yayılım 1 saate kadar sürebilir)
	await rest.put(Routes.applicationCommands(appConfig.clientId), { body });
}


