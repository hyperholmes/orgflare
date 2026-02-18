import { Atom, AttentionValue, Link } from "../../types/cognitive";

/**
 * Economic Attention Network (ECAN)
 *
 * Complete attention allocation with rent, wages, and Hebbian learning
 */

export interface ECANConfig {
	rentRate: number;
	wageRate: number;
	focusSize: number;
	minSTI: number;
	minLTI: number;
	hebbianLearningRate: number;
	forgettingThreshold: number;
}

export interface AttentionStats {
	totalSTI: number;
	totalLTI: number;
	avgSTI: number;
	avgLTI: number;
	focusAtoms: number;
	totalAtoms: number;
	rentCollected: number;
	wagesDistributed: number;
}

export interface HebbianUpdate {
	link: string;
	oldStrength: number;
	newStrength: number;
	coactivation: number;
}

export class AttentionAllocation {
	private config: ECANConfig;
	private atomSpace: DurableObjectStub;
	private stats: AttentionStats;
	private coactivationHistory: Map<string, number[]> = new Map();

	constructor(atomSpace: DurableObjectStub, config?: Partial<ECANConfig>) {
		this.atomSpace = atomSpace;
		this.config = {
			rentRate: 0.1,
			wageRate: 0.05,
			focusSize: 100,
			minSTI: 1,
			minLTI: 1,
			hebbianLearningRate: 0.1,
			forgettingThreshold: 0.5,
			...config,
		};

		this.stats = {
			totalSTI: 0,
			totalLTI: 0,
			avgSTI: 0,
			avgLTI: 0,
			focusAtoms: 0,
			totalAtoms: 0,
			rentCollected: 0,
			wagesDistributed: 0,
		};
	}

	/**
	 * Run complete attention allocation cycle
	 */
	async allocateAttention(): Promise<AttentionStats> {
		// Reset stats
		this.stats.rentCollected = 0;
		this.stats.wagesDistributed = 0;

		// 1. Collect rent from all atoms
		await this.collectRent();

		// 2. Distribute wages to important atoms
		await this.distributeWages();

		// 3. Apply Hebbian learning
		await this.hebbianUpdate();

		// 4. Update attentional focus
		await this.updateFocus();

		// 5. Spread importance
		await this.spreadImportance();

		// 6. Forget low-importance atoms
		await this.forget();

		// 7. Update statistics
		await this.updateStatistics();

		return this.stats;
	}

	/**
	 * Collect rent from all atoms
	 */
	private async collectRent(): Promise<void> {
		const response = await this.atomSpace.fetch(
			new Request("http://dummy/atoms"),
		);
		const data = await response.json();

		if (!data.success) return;

		const atoms: Atom[] = data.data;

		for (const atom of atoms) {
			// Calculate rent based on STI
			const rent = Math.max(0, atom.attentionValue.sti * this.config.rentRate);

			// Deduct rent from STI
			atom.attentionValue.sti = Math.max(
				this.config.minSTI,
				atom.attentionValue.sti - rent,
			);

			// Transfer some rent to LTI (long-term importance)
			atom.attentionValue.lti += rent * 0.1;

			// Update atom
			await this.updateAtomAttention(atom);

			this.stats.rentCollected += rent;
		}
	}

	/**
	 * Distribute wages to important atoms
	 */
	private async distributeWages(): Promise<void> {
		// Get high-LTI atoms (historically important)
		const response = await this.atomSpace.fetch(
			new Request(`http://dummy/atoms?sortBy=lti&limit=200`),
		);
		const data = await response.json();

		if (!data.success) return;

		const atoms: Atom[] = data.data;

		for (const atom of atoms) {
			// Calculate wage based on LTI
			const wage = atom.attentionValue.lti * this.config.wageRate;

			// Add wage to STI
			atom.attentionValue.sti += wage;

			// Update atom
			await this.updateAtomAttention(atom);

			this.stats.wagesDistributed += wage;
		}
	}

	/**
	 * Apply Hebbian learning to strengthen co-activated links
	 */
	private async hebbianUpdate(): Promise<void> {
		// Get atoms in attentional focus
		const focusResponse = await this.atomSpace.fetch(
			new Request(`http://dummy/atoms?inFocus=true`),
		);
		const focusData = await focusResponse.json();

		if (!focusData.success) return;

		const focusAtoms: Atom[] = focusData.data;
		const focusIds = new Set(focusAtoms.map((a) => a.id));

		// Get links between focus atoms
		const linksResponse = await this.atomSpace.fetch(
			new Request("http://dummy/links"),
		);
		const linksData = await linksResponse.json();

		if (!linksData.success) return;

		const links: Link[] = linksData.data;

		for (const link of links) {
			// Check if both endpoints are in focus (co-activated)
			const coactivated = link.outgoing.every((id) => focusIds.has(id));

			if (coactivated) {
				// Strengthen link (Hebbian learning)
				const oldSTI = link.attentionValue.sti;
				const boost = this.config.hebbianLearningRate * 10;
				link.attentionValue.sti += boost;
				link.attentionValue.lti += boost * 0.1;

				// Also strengthen truth value
				link.truthValue.strength = Math.min(
					1.0,
					link.truthValue.strength + this.config.hebbianLearningRate * 0.1,
				);

				await this.updateAtomAttention(link);

				// Record coactivation
				this.recordCoactivation(link.id);
			} else {
				// Decay link if not co-activated
				link.attentionValue.sti *= 0.95;
				await this.updateAtomAttention(link);
			}
		}
	}

	/**
	 * Update attentional focus
	 */
	private async updateFocus(): Promise<void> {
		// Get top N atoms by STI
		const response = await this.atomSpace.fetch(
			new Request(
				`http://dummy/atoms?sortBy=sti&limit=${this.config.focusSize}`,
			),
		);
		const data = await response.json();

		if (!data.success) return;

		// First, clear all focus flags
		await this.clearAllFocus();

		// Set focus for top atoms
		const focusAtoms: Atom[] = data.data;

		for (const atom of focusAtoms) {
			atom.attentionValue.vlti = 1; // Use VLTI as focus flag
			await this.updateAtomAttention(atom);
		}

		this.stats.focusAtoms = focusAtoms.length;
	}

	/**
	 * Spread importance from high-STI atoms to neighbors
	 */
	private async spreadImportance(): Promise<void> {
		// Get high-STI atoms
		const response = await this.atomSpace.fetch(
			new Request(`http://dummy/atoms?minSTI=50&limit=100`),
		);
		const data = await response.json();

		if (!data.success) return;

		const atoms: Atom[] = data.data;

		for (const atom of atoms) {
			// Get incoming and outgoing links
			const neighbors = await this.getNeighbors(atom.id);

			// Spread importance to neighbors
			const spreadAmount = atom.attentionValue.sti * 0.05;

			for (const neighbor of neighbors) {
				neighbor.attentionValue.sti += spreadAmount;
				await this.updateAtomAttention(neighbor);
			}
		}
	}

	/**
	 * Forget atoms with very low importance
	 */
	private async forget(): Promise<void> {
		// Get atoms below forgetting threshold
		const response = await this.atomSpace.fetch(
			new Request(
				`http://dummy/atoms?maxSTI=${this.config.forgettingThreshold}&maxLTI=${this.config.forgettingThreshold}`,
			),
		);
		const data = await response.json();

		if (!data.success) return;

		const atoms: Atom[] = data.data;

		// Delete low-importance atoms
		for (const atom of atoms) {
			await this.atomSpace.fetch(
				new Request(`http://dummy/atom/${atom.id}`, {
					method: "DELETE",
				}),
			);
		}
	}

	/**
	 * Update atom attention values
	 */
	private async updateAtomAttention(atom: Atom): Promise<void> {
		await this.atomSpace.fetch(
			new Request(`http://dummy/atom/${atom.id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					attentionValue: atom.attentionValue,
					truthValue: atom.truthValue,
				}),
			}),
		);
	}

	/**
	 * Clear focus flags from all atoms
	 */
	private async clearAllFocus(): Promise<void> {
		const response = await this.atomSpace.fetch(
			new Request("http://dummy/atoms?inFocus=true"),
		);
		const data = await response.json();

		if (!data.success) return;

		const atoms: Atom[] = data.data;

		for (const atom of atoms) {
			atom.attentionValue.vlti = 0;
			await this.updateAtomAttention(atom);
		}
	}

	/**
	 * Get neighbors of an atom
	 */
	private async getNeighbors(atomId: string): Promise<Atom[]> {
		// Get incoming links
		const incomingResponse = await this.atomSpace.fetch(
			new Request(`http://dummy/atom/${atomId}/incoming`),
		);
		const incomingData = await incomingResponse.json();

		// Get outgoing links
		const outgoingResponse = await this.atomSpace.fetch(
			new Request(`http://dummy/atom/${atomId}/outgoing`),
		);
		const outgoingData = await outgoingResponse.json();

		const neighbors: Atom[] = [];

		if (incomingData.success) {
			neighbors.push(...incomingData.data);
		}

		if (outgoingData.success) {
			neighbors.push(...outgoingData.data);
		}

		return neighbors;
	}

	/**
	 * Record coactivation for Hebbian learning
	 */
	private recordCoactivation(linkId: string): void {
		if (!this.coactivationHistory.has(linkId)) {
			this.coactivationHistory.set(linkId, []);
		}

		const history = this.coactivationHistory.get(linkId)!;
		history.push(Date.now());

		// Keep only recent history (last 100 events)
		if (history.length > 100) {
			history.shift();
		}
	}

	/**
	 * Update statistics
	 */
	private async updateStatistics(): Promise<void> {
		const response = await this.atomSpace.fetch(
			new Request("http://dummy/atoms"),
		);
		const data = await response.json();

		if (!data.success) return;

		const atoms: Atom[] = data.data;

		this.stats.totalAtoms = atoms.length;
		this.stats.totalSTI = atoms.reduce(
			(sum, a) => sum + a.attentionValue.sti,
			0,
		);
		this.stats.totalLTI = atoms.reduce(
			(sum, a) => sum + a.attentionValue.lti,
			0,
		);
		this.stats.avgSTI =
			atoms.length > 0 ? this.stats.totalSTI / atoms.length : 0;
		this.stats.avgLTI =
			atoms.length > 0 ? this.stats.totalLTI / atoms.length : 0;
	}

	/**
	 * Get attention statistics
	 */
	getStatistics(): AttentionStats {
		return this.stats;
	}

	/**
	 * Get configuration
	 */
	getConfig(): ECANConfig {
		return this.config;
	}

	/**
	 * Update configuration
	 */
	updateConfig(config: Partial<ECANConfig>): void {
		this.config = { ...this.config, ...config };
	}

	/**
	 * Get coactivation history
	 */
	getCoactivationHistory(linkId: string): number[] {
		return this.coactivationHistory.get(linkId) || [];
	}

	/**
	 * Stimulus-driven attention update
	 */
	async stimulusAttention(atomIds: string[], boost: number = 20): Promise<void> {
		for (const atomId of atomIds) {
			const response = await this.atomSpace.fetch(
				new Request(`http://dummy/atom/${atomId}`),
			);
			const data = await response.json();

			if (data.success) {
				const atom: Atom = data.data;
				atom.attentionValue.sti += boost;
				await this.updateAtomAttention(atom);
			}
		}
	}
}
