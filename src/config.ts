import dotenv from 'dotenv';

dotenv.config();

function requireEnv(variableName: string): string {
	const value = process.env[variableName];
	if (!value || value.trim() === '') {
		throw new Error(`Gerekli ortam değişkeni eksik: ${variableName}`);
	}
	return value;
}

function optionalEnv(variableName: string): string | undefined {
	const value = process.env[variableName];
	if (!value || value.trim() === '') return undefined;
	return value;
}

export const config = {
	discordToken: requireEnv('DISCORD_TOKEN'),
	clientId: requireEnv('DISCORD_CLIENT_ID'),
	guildId: optionalEnv('DISCORD_GUILD_ID'),
	supportRoleId: optionalEnv('SUPPORT_ROLE_ID'),
	ticketCategoryId: optionalEnv('TICKET_CATEGORY_ID'),
	ownerUserId: optionalEnv('BOT_OWNER_ID'),
	enableMessageContentIntent: process.env.MESSAGE_CONTENT_INTENT === 'true',
	enableGuildMembersIntent: process.env.GUILD_MEMBERS_INTENT === 'true',
};


