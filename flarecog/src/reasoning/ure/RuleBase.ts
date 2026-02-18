import { Rule, RuleBase, RuleType, RuleTemplate } from "./RuleTypes";
import { nanoid } from "nanoid";

/**
 * Rule Base - Storage and management of inference rules
 *
 * Provides CRUD operations for rules and efficient rule retrieval
 */

export class RuleBaseManager {
	private ruleBase: RuleBase;

	constructor(name: string = "default") {
		this.ruleBase = {
			id: nanoid(),
			name,
			rules: new Map(),
			categories: new Map(),
			metadata: {
				totalRules: 0,
				avgComplexity: 0,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			},
		};
	}

	/**
	 * Add a rule to the rule base
	 */
	addRule(rule: Rule): void {
		this.ruleBase.rules.set(rule.id, rule);

		// Update category index
		const category = rule.metadata.category;
		if (!this.ruleBase.categories.has(category)) {
			this.ruleBase.categories.set(category, []);
		}
		this.ruleBase.categories.get(category)!.push(rule.id);

		// Update metadata
		this.updateMetadata();
	}

	/**
	 * Get a rule by ID
	 */
	getRule(id: string): Rule | undefined {
		return this.ruleBase.rules.get(id);
	}

	/**
	 * Get all rules
	 */
	getAllRules(): Rule[] {
		return Array.from(this.ruleBase.rules.values());
	}

	/**
	 * Get rules by category
	 */
	getRulesByCategory(category: string): Rule[] {
		const ruleIds = this.ruleBase.categories.get(category) || [];
		return ruleIds
			.map((id) => this.ruleBase.rules.get(id))
			.filter((rule): rule is Rule => rule !== undefined);
	}

	/**
	 * Get rules by type
	 */
	getRulesByType(type: RuleType): Rule[] {
		return this.getAllRules().filter((rule) => rule.type === type);
	}

	/**
	 * Remove a rule
	 */
	removeRule(id: string): boolean {
		const rule = this.ruleBase.rules.get(id);
		if (!rule) return false;

		// Remove from rules map
		this.ruleBase.rules.delete(id);

		// Remove from category index
		const category = rule.metadata.category;
		const categoryRules = this.ruleBase.categories.get(category);
		if (categoryRules) {
			const index = categoryRules.indexOf(id);
			if (index > -1) {
				categoryRules.splice(index, 1);
			}
		}

		// Update metadata
		this.updateMetadata();

		return true;
	}

	/**
	 * Update a rule
	 */
	updateRule(id: string, updates: Partial<Rule>): boolean {
		const rule = this.ruleBase.rules.get(id);
		if (!rule) return false;

		const updatedRule = { ...rule, ...updates };
		updatedRule.metadata.updatedAt = Date.now();

		this.ruleBase.rules.set(id, updatedRule);
		this.updateMetadata();

		return true;
	}

	/**
	 * Select rules based on strategy
	 */
	selectRules(
		strategy: "priority" | "weight" | "random" | "success_rate" | "complexity",
		count: number = 10,
	): Rule[] {
		const allRules = this.getAllRules();

		switch (strategy) {
			case "priority":
				return allRules
					.sort((a, b) => b.priority - a.priority)
					.slice(0, count);

			case "weight":
				return this.weightedRandomSelection(allRules, count);

			case "random":
				return this.shuffleArray(allRules).slice(0, count);

			case "success_rate":
				return allRules
					.sort(
						(a, b) =>
							(b.metadata.successRate || 0) - (a.metadata.successRate || 0),
					)
					.slice(0, count);

			case "complexity":
				return allRules
					.sort((a, b) => a.metadata.complexity - b.metadata.complexity)
					.slice(0, count);

			default:
				return allRules.slice(0, count);
		}
	}

	/**
	 * Weighted random selection of rules
	 */
	private weightedRandomSelection(rules: Rule[], count: number): Rule[] {
		const selected: Rule[] = [];
		const totalWeight = rules.reduce((sum, rule) => sum + rule.weight, 0);

		for (let i = 0; i < count && rules.length > 0; i++) {
			let random = Math.random() * totalWeight;
			let cumulativeWeight = 0;

			for (const rule of rules) {
				cumulativeWeight += rule.weight;
				if (random <= cumulativeWeight) {
					selected.push(rule);
					break;
				}
			}
		}

		return selected;
	}

	/**
	 * Shuffle array (Fisher-Yates algorithm)
	 */
	private shuffleArray<T>(array: T[]): T[] {
		const shuffled = [...array];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}
		return shuffled;
	}

	/**
	 * Update rule base metadata
	 */
	private updateMetadata(): void {
		const rules = this.getAllRules();

		this.ruleBase.metadata.totalRules = rules.length;
		this.ruleBase.metadata.avgComplexity =
			rules.length > 0
				? rules.reduce((sum, rule) => sum + rule.metadata.complexity, 0) /
					rules.length
				: 0;
		this.ruleBase.metadata.updatedAt = Date.now();
	}

	/**
	 * Export rule base to JSON
	 */
	export(): string {
		const exportData = {
			...this.ruleBase,
			rules: Array.from(this.ruleBase.rules.entries()),
			categories: Array.from(this.ruleBase.categories.entries()),
		};
		return JSON.stringify(exportData);
	}

	/**
	 * Import rule base from JSON
	 */
	import(json: string): void {
		const importData = JSON.parse(json);

		this.ruleBase.id = importData.id;
		this.ruleBase.name = importData.name;
		this.ruleBase.rules = new Map(importData.rules);
		this.ruleBase.categories = new Map(importData.categories);
		this.ruleBase.metadata = importData.metadata;
	}

	/**
	 * Get rule base
	 */
	getRuleBase(): RuleBase {
		return this.ruleBase;
	}

	/**
	 * Get statistics
	 */
	getStatistics(): {
		totalRules: number;
		rulesByType: Record<string, number>;
		rulesByCategory: Record<string, number>;
		avgPriority: number;
		avgWeight: number;
		avgComplexity: number;
	} {
		const rules = this.getAllRules();

		const rulesByType: Record<string, number> = {};
		const rulesByCategory: Record<string, number> = {};
		let totalPriority = 0;
		let totalWeight = 0;

		for (const rule of rules) {
			// Count by type
			rulesByType[rule.type] = (rulesByType[rule.type] || 0) + 1;

			// Count by category
			const category = rule.metadata.category;
			rulesByCategory[category] = (rulesByCategory[category] || 0) + 1;

			// Sum for averages
			totalPriority += rule.priority;
			totalWeight += rule.weight;
		}

		return {
			totalRules: rules.length,
			rulesByType,
			rulesByCategory,
			avgPriority: rules.length > 0 ? totalPriority / rules.length : 0,
			avgWeight: rules.length > 0 ? totalWeight / rules.length : 0,
			avgComplexity: this.ruleBase.metadata.avgComplexity,
		};
	}

	/**
	 * Create rule from template
	 */
	static createRuleFromTemplate(template: RuleTemplate): Rule {
		// This is a simplified version
		// In a full implementation, would parse patterns and create BindLink
		return {
			id: nanoid(),
			name: template.name,
			type: template.type,
			bindLink: {
				id: nanoid(),
				type: "BindLink",
				outgoing: ["var_list", "pattern", "rewrite"],
				truthValue: { strength: 1.0, confidence: 1.0 },
				attentionValue: { sti: 0, lti: 0, vlti: 0 },
				createdAt: Date.now(),
				updatedAt: Date.now(),
			},
			priority: template.priority,
			weight: template.weight,
			metadata: {
				description: `Rule created from template: ${template.name}`,
				category: template.type,
				complexity: 5,
				timesApplied: 0,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			},
		};
	}
}
