/**
 * ECAN (Economic Attention Network) Implementation
 * 
 * Implements OpenCog's attention allocation mechanism using economic principles.
 * Manages STI (Short-Term Importance), LTI (Long-Term Importance), and VLTI
 * (Very Long-Term Importance) for atoms in the AtomSpace.
 */

import { Atom, AttentionValue, Link } from "../types/cognitive";

/**
 * ECAN Configuration
 */
export interface ECANConfig {
	// Attention Bank
	totalSTI: number; // Total STI in the system
	targetSTI: number; // Target STI for attentional focus
	minSTI: number; // Minimum STI before forgetting
	maxSTI: number; // Maximum STI for any atom

	// Decay rates
	stiDecayRate: number; // STI decay per cycle
	ltiDecayRate: number; // LTI decay per cycle

	// Spreading parameters
	spreadingFactor: number; // How much STI spreads
	maxSpreadingHops: number; // Maximum hops for spreading

	// Hebbian learning
	hebbianLearningRate: number; // Rate of Hebbian updates
	coactivationThreshold: number; // Threshold for Hebbian learning

	// Rent collection
	rentCollectionRate: number; // STI rent per cycle
	rentThreshold: number; // STI threshold for rent
}

/**
 * Attention Bank - Manages total attention in the system
 */
export class AttentionBank {
	private totalSTI: number;
	private targetSTI: number;
	private atomSTI: Map<string, number> = new Map();

	constructor(config: ECANConfig) {
		this.totalSTI = config.totalSTI;
		this.targetSTI = config.targetSTI;
	}

	/**
	 * Get current total STI in circulation
	 */
	getCurrentSTI(): number {
		let total = 0;
		for (const sti of this.atomSTI.values()) {
			total += sti;
		}
		return total;
	}

	/**
	 * Allocate STI to an atom
	 */
	allocateSTI(atomId: string, amount: number): number {
		const current = this.atomSTI.get(atomId) || 0;
		const newSTI = current + amount;
		this.atomSTI.set(atomId, newSTI);
		return newSTI;
	}

	/**
	 * Collect rent from atoms
	 */
	collectRent(atomId: string, amount: number): number {
		const current = this.atomSTI.get(atomId) || 0;
		const rent = Math.min(amount, current);
		this.atomSTI.set(atomId, current - rent);
		return rent;
	}

	/**
	 * Normalize STI to maintain economic balance
	 */
	normalize(): void {
		const currentTotal = this.getCurrentSTI();
		if (currentTotal === 0) return;

		const scaleFactor = this.totalSTI / currentTotal;
		for (const [atomId, sti] of this.atomSTI.entries()) {
			this.atomSTI.set(atomId, sti * scaleFactor);
		}
	}

	/**
	 * Get atoms in attentional focus
	 */
	getAttentionalFocus(threshold: number): string[] {
		const focus: string[] = [];
		for (const [atomId, sti] of this.atomSTI.entries()) {
			if (sti >= threshold) {
				focus.push(atomId);
			}
		}
		return focus.sort((a, b) => {
			const stiA = this.atomSTI.get(a) || 0;
			const stiB = this.atomSTI.get(b) || 0;
			return stiB - stiA; // Descending order
		});
	}
}

/**
 * ECAN Manager
 */
export class ECANManager {
	private config: ECANConfig;
	private attentionBank: AttentionBank;
	private coactivationHistory: Map<string, Set<string>> = new Map();

	constructor(config?: Partial<ECANConfig>) {
		this.config = {
			totalSTI: 100000,
			targetSTI: 50000,
			minSTI: -100,
			maxSTI: 1000,
			stiDecayRate: 0.1,
			ltiDecayRate: 0.01,
			spreadingFactor: 0.2,
			maxSpreadingHops: 3,
			hebbianLearningRate: 0.05,
			coactivationThreshold: 0.7,
			rentCollectionRate: 0.05,
			rentThreshold: 100,
			...config,
		};

		this.attentionBank = new AttentionBank(this.config);
	}

	/**
	 * Update attention values for an atom
	 */
	updateAttention(atom: Atom, stimulus: number = 0): AttentionValue {
		const currentAV = atom.attentionValue;

		// Apply stimulus
		let newSTI = currentAV.sti + stimulus;

		// Apply decay
		newSTI = newSTI * (1 - this.config.stiDecayRate);

		// Collect rent if above threshold
		if (newSTI > this.config.rentThreshold) {
			const rent = newSTI * this.config.rentCollectionRate;
			newSTI -= rent;
		}

		// Clamp STI
		newSTI = Math.max(
			this.config.minSTI,
			Math.min(this.config.maxSTI, newSTI)
		);

		// Update LTI based on STI history
		let newLTI = currentAV.lti;
		if (newSTI > 0) {
			newLTI += newSTI * 0.01; // Accumulate LTI from positive STI
		}
		newLTI = newLTI * (1 - this.config.ltiDecayRate);

		// VLTI remains constant (set by system)
		const newVLTI = currentAV.vlti;

		return {
			sti: Math.round(newSTI),
			lti: Math.round(newLTI),
			vlti: newVLTI,
		};
	}

	/**
	 * Spread importance through connected atoms
	 */
	async spreadImportance(
		sourceAtom: Atom,
		connectedAtoms: Atom[],
		getIncoming: (atomId: string) => Promise<Link[]>
	): Promise<Map<string, number>> {
		const spreadMap = new Map<string, number>();
		const visited = new Set<string>();
		const queue: Array<{ atomId: string; sti: number; hops: number }> = [
			{ atomId: sourceAtom.id, sti: sourceAtom.attentionValue.sti, hops: 0 },
		];

		while (queue.length > 0) {
			const current = queue.shift()!;

			if (visited.has(current.atomId)) continue;
			visited.add(current.atomId);

			if (current.hops >= this.config.maxSpreadingHops) continue;

			// Calculate spread amount
			const spreadAmount =
				current.sti * this.config.spreadingFactor * (1 / (current.hops + 1));

			if (spreadAmount < 1) continue; // Stop spreading if amount too small

			// Get connected atoms
			const incoming = await getIncoming(current.atomId);

			for (const link of incoming) {
				for (const targetId of link.outgoing) {
					if (targetId === current.atomId) continue;

					// Accumulate spread
					const currentSpread = spreadMap.get(targetId) || 0;
					spreadMap.set(targetId, currentSpread + spreadAmount);

					// Add to queue for further spreading
					queue.push({
						atomId: targetId,
						sti: spreadAmount,
						hops: current.hops + 1,
					});
				}
			}
		}

		return spreadMap;
	}

	/**
	 * Hebbian learning - strengthen connections between coactivated atoms
	 */
	hebbianUpdate(atom1: Atom, atom2: Atom, link?: Link): number {
		// Check if both atoms are in attentional focus
		const sti1 = atom1.attentionValue.sti;
		const sti2 = atom2.attentionValue.sti;

		const threshold = this.config.coactivationThreshold * this.config.maxSTI;

		if (sti1 < threshold || sti2 < threshold) {
			return 0; // No Hebbian update if not coactivated
		}

		// Record coactivation
		if (!this.coactivationHistory.has(atom1.id)) {
			this.coactivationHistory.set(atom1.id, new Set());
		}
		this.coactivationHistory.get(atom1.id)!.add(atom2.id);

		// Calculate Hebbian strength increase
		const coactivationStrength = (sti1 / this.config.maxSTI) * (sti2 / this.config.maxSTI);
		const strengthIncrease = coactivationStrength * this.config.hebbianLearningRate;

		return strengthIncrease;
	}

	/**
	 * Forget atoms with very low STI
	 */
	shouldForget(atom: Atom): boolean {
		const sti = atom.attentionValue.sti;
		const lti = atom.attentionValue.lti;
		const vlti = atom.attentionValue.vlti;

		// Never forget atoms with high VLTI
		if (vlti > 0) return false;

		// Never forget atoms with high LTI
		if (lti > 100) return false;

		// Forget if STI is below minimum
		return sti < this.config.minSTI;
	}

	/**
	 * Get attentional focus - atoms currently being processed
	 */
	getAttentionalFocus(atoms: Atom[], topN: number = 20): Atom[] {
		return atoms
			.filter((a) => a.attentionValue.sti > 0)
			.sort((a, b) => b.attentionValue.sti - a.attentionValue.sti)
			.slice(0, topN);
	}

	/**
	 * Stimulate atom - increase STI
	 */
	stimulate(atom: Atom, amount: number): AttentionValue {
		return this.updateAttention(atom, amount);
	}

	/**
	 * Calculate attention allocation for multiple atoms
	 */
	allocateAttention(
		atoms: Atom[],
		totalStimulus: number,
		weights?: Map<string, number>
	): Map<string, number> {
		const allocation = new Map<string, number>();

		if (!weights) {
			// Equal distribution
			const perAtom = totalStimulus / atoms.length;
			for (const atom of atoms) {
				allocation.set(atom.id, perAtom);
			}
		} else {
			// Weighted distribution
			let totalWeight = 0;
			for (const weight of weights.values()) {
				totalWeight += weight;
			}

			for (const atom of atoms) {
				const weight = weights.get(atom.id) || 0;
				const stimulus = (weight / totalWeight) * totalStimulus;
				allocation.set(atom.id, stimulus);
			}
		}

		return allocation;
	}

	/**
	 * Run ECAN cycle
	 */
	async runCycle(
		atoms: Atom[],
		getIncoming: (atomId: string) => Promise<Link[]>
	): Promise<Map<string, AttentionValue>> {
		const updates = new Map<string, AttentionValue>();

		// 1. Decay all atoms
		for (const atom of atoms) {
			const newAV = this.updateAttention(atom, 0);
			updates.set(atom.id, newAV);
		}

		// 2. Spread importance from high-STI atoms
		const focus = this.getAttentionalFocus(atoms, 10);
		for (const atom of focus) {
			const spreadMap = await this.spreadImportance(atom, atoms, getIncoming);

			// Apply spread
			for (const [targetId, spreadAmount] of spreadMap.entries()) {
				const target = atoms.find((a) => a.id === targetId);
				if (target) {
					const currentAV = updates.get(targetId) || target.attentionValue;
					const newAV = this.updateAttention(
						{ ...target, attentionValue: currentAV },
						spreadAmount
					);
					updates.set(targetId, newAV);
				}
			}
		}

		// 3. Normalize attention bank
		this.attentionBank.normalize();

		return updates;
	}

	/**
	 * Get ECAN statistics
	 */
	getStatistics(atoms: Atom[]): {
		totalSTI: number;
		averageSTI: number;
		totalLTI: number;
		averageLTI: number;
		focusSize: number;
		forgettableAtoms: number;
	} {
		let totalSTI = 0;
		let totalLTI = 0;
		let forgettableCount = 0;

		for (const atom of atoms) {
			totalSTI += atom.attentionValue.sti;
			totalLTI += atom.attentionValue.lti;
			if (this.shouldForget(atom)) {
				forgettableCount++;
			}
		}

		const focus = this.getAttentionalFocus(atoms);

		return {
			totalSTI,
			averageSTI: atoms.length > 0 ? totalSTI / atoms.length : 0,
			totalLTI,
			averageLTI: atoms.length > 0 ? totalLTI / atoms.length : 0,
			focusSize: focus.length,
			forgettableAtoms: forgettableCount,
		};
	}

	/**
	 * Get configuration
	 */
	getConfig(): ECANConfig {
		return { ...this.config };
	}

	/**
	 * Update configuration
	 */
	updateConfig(config: Partial<ECANConfig>): void {
		this.config = { ...this.config, ...config };
	}
}
