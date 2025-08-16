import { commands } from './commands';
import { deployCommands } from './lib/deployCommands';

async function main(): Promise<void> {
	console.log('⌛ Slash komutları gönderiliyor...');
	await deployCommands();
	console.log(`✅ ${commands.length} komut başarıyla güncellendi.`);
}

main().catch((err) => {
	console.error('🚨 Komut dağıtımı hata verdi:', err);
	process.exit(1);
});


