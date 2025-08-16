const channelIdToFlow: Map<string, string[]> = new Map();

export function addFlowEvent(channelId: string, event: string): void {
	const list = channelIdToFlow.get(channelId) ?? [];
	list.push(`${new Date().toLocaleString()} - ${event}`);
	channelIdToFlow.set(channelId, list);
}

export function getAndClearFlowEvents(channelId: string): string[] {
	const list = channelIdToFlow.get(channelId) ?? [];
	channelIdToFlow.delete(channelId);
	return list;
}


