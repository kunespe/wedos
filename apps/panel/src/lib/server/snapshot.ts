import { broker, BrokerError, brokerEnabled, type Snapshot } from './broker';

export type SnapshotResult = { snapshot: Snapshot | null; error: string | null; enabled: boolean };

/** Loads the broker snapshot; pages render a calm empty state instead of a 500 when it is unavailable. */
export async function loadSnapshot(): Promise<SnapshotResult> {
	if (!brokerEnabled()) return { snapshot: null, error: null, enabled: false };
	try {
		return { snapshot: await broker<Snapshot>('snapshot'), error: null, enabled: true };
	} catch (e) {
		return { snapshot: null, error: e instanceof BrokerError ? e.message : 'Provozní služba není dostupná.', enabled: true };
	}
}
