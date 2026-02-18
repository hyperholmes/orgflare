import { Env } from "../types/cognitive";

/**
 * Episodic Memory Manager - Long-term memory storage using D1
 *
 * Stores cognitive episodes, experiences, and historical reasoning traces
 * for learning and recall.
 */

export interface Episode {
	id: string;
	type: EpisodeType;
	timestamp: number;
	duration?: number;
	context: Record<string, any>;
	atoms: string[]; // Atom IDs involved
	outcome?: string;
	importance: number; // 0-100
	tags: string[];
}

export type EpisodeType =
	| "perception"
	| "action"
	| "reasoning"
	| "goal_completion"
	| "learning"
	| "interaction"
	| "error";

export interface EpisodeQuery {
	type?: EpisodeType;
	startTime?: number;
	endTime?: number;
	minImportance?: number;
	tags?: string[];
	limit?: number;
	offset?: number;
}

export class EpisodicMemory {
	private db: D1Database;

	constructor(db: D1Database) {
		this.db = db;
	}

	/**
	 * Initialize episodic memory schema
	 */
	async initialize(): Promise<void> {
		await this.db
			.prepare(
				`
			CREATE TABLE IF NOT EXISTS episodes (
				id TEXT PRIMARY KEY,
				type TEXT NOT NULL,
				timestamp INTEGER NOT NULL,
				duration INTEGER,
				context TEXT NOT NULL,
				atoms TEXT NOT NULL,
				outcome TEXT,
				importance INTEGER NOT NULL,
				tags TEXT NOT NULL,
				created_at INTEGER NOT NULL
			)
		`,
			)
			.run();

		await this.db
			.prepare(
				`
			CREATE INDEX IF NOT EXISTS idx_episodes_type ON episodes(type)
		`,
			)
			.run();

		await this.db
			.prepare(
				`
			CREATE INDEX IF NOT EXISTS idx_episodes_timestamp ON episodes(timestamp)
		`,
			)
			.run();

		await this.db
			.prepare(
				`
			CREATE INDEX IF NOT EXISTS idx_episodes_importance ON episodes(importance)
		`,
			)
			.run();

		// Reasoning traces table
		await this.db
			.prepare(
				`
			CREATE TABLE IF NOT EXISTS reasoning_traces (
				id TEXT PRIMARY KEY,
				episode_id TEXT NOT NULL,
				step_number INTEGER NOT NULL,
				rule TEXT NOT NULL,
				premises TEXT NOT NULL,
				conclusion TEXT NOT NULL,
				truth_strength REAL NOT NULL,
				truth_confidence REAL NOT NULL,
				timestamp INTEGER NOT NULL,
				FOREIGN KEY (episode_id) REFERENCES episodes(id)
			)
		`,
			)
			.run();

		await this.db
			.prepare(
				`
			CREATE INDEX IF NOT EXISTS idx_reasoning_episode ON reasoning_traces(episode_id)
		`,
			)
			.run();

		// Agent execution history
		await this.db
			.prepare(
				`
			CREATE TABLE IF NOT EXISTS agent_executions (
				id TEXT PRIMARY KEY,
				agent_id TEXT NOT NULL,
				agent_type TEXT NOT NULL,
				timestamp INTEGER NOT NULL,
				execution_time INTEGER NOT NULL,
				atoms_processed INTEGER NOT NULL,
				atoms_created INTEGER NOT NULL,
				atoms_modified INTEGER NOT NULL,
				success INTEGER NOT NULL,
				error TEXT,
				metrics TEXT
			)
		`,
			)
			.run();

		await this.db
			.prepare(
				`
			CREATE INDEX IF NOT EXISTS idx_agent_executions_agent ON agent_executions(agent_id)
		`,
			)
			.run();

		await this.db
			.prepare(
				`
			CREATE INDEX IF NOT EXISTS idx_agent_executions_timestamp ON agent_executions(timestamp)
		`,
			)
			.run();
	}

	/**
	 * Store an episode
	 */
	async storeEpisode(episode: Episode): Promise<void> {
		await this.db
			.prepare(
				`
			INSERT INTO episodes (id, type, timestamp, duration, context, atoms, outcome, importance, tags, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			)
			.bind(
				episode.id,
				episode.type,
				episode.timestamp,
				episode.duration || null,
				JSON.stringify(episode.context),
				JSON.stringify(episode.atoms),
				episode.outcome || null,
				episode.importance,
				JSON.stringify(episode.tags),
				Date.now(),
			)
			.run();
	}

	/**
	 * Retrieve an episode by ID
	 */
	async getEpisode(id: string): Promise<Episode | null> {
		const result = await this.db
			.prepare(
				`
			SELECT * FROM episodes WHERE id = ?
		`,
			)
			.bind(id)
			.first();

		if (!result) return null;

		return this.rowToEpisode(result);
	}

	/**
	 * Query episodes
	 */
	async queryEpisodes(query: EpisodeQuery): Promise<Episode[]> {
		let sql = "SELECT * FROM episodes WHERE 1=1";
		const bindings: any[] = [];

		if (query.type) {
			sql += " AND type = ?";
			bindings.push(query.type);
		}

		if (query.startTime) {
			sql += " AND timestamp >= ?";
			bindings.push(query.startTime);
		}

		if (query.endTime) {
			sql += " AND timestamp <= ?";
			bindings.push(query.endTime);
		}

		if (query.minImportance) {
			sql += " AND importance >= ?";
			bindings.push(query.minImportance);
		}

		if (query.tags && query.tags.length > 0) {
			// Simple tag matching - could be enhanced with JSON functions
			for (const tag of query.tags) {
				sql += " AND tags LIKE ?";
				bindings.push(`%"${tag}"%`);
			}
		}

		sql += " ORDER BY timestamp DESC";

		if (query.limit) {
			sql += " LIMIT ?";
			bindings.push(query.limit);
		}

		if (query.offset) {
			sql += " OFFSET ?";
			bindings.push(query.offset);
		}

		const result = await this.db.prepare(sql).bind(...bindings).all();

		return result.results.map((row) => this.rowToEpisode(row));
	}

	/**
	 * Get recent episodes
	 */
	async getRecentEpisodes(limit: number = 10): Promise<Episode[]> {
		return this.queryEpisodes({ limit });
	}

	/**
	 * Get episodes by importance
	 */
	async getImportantEpisodes(
		minImportance: number = 70,
		limit: number = 10,
	): Promise<Episode[]> {
		return this.queryEpisodes({ minImportance, limit });
	}

	/**
	 * Store reasoning trace
	 */
	async storeReasoningTrace(
		episodeId: string,
		stepNumber: number,
		rule: string,
		premises: string[],
		conclusion: string,
		truthStrength: number,
		truthConfidence: number,
	): Promise<void> {
		await this.db
			.prepare(
				`
			INSERT INTO reasoning_traces (id, episode_id, step_number, rule, premises, conclusion, truth_strength, truth_confidence, timestamp)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			)
			.bind(
				`${episodeId}_${stepNumber}`,
				episodeId,
				stepNumber,
				rule,
				JSON.stringify(premises),
				conclusion,
				truthStrength,
				truthConfidence,
				Date.now(),
			)
			.run();
	}

	/**
	 * Get reasoning traces for an episode
	 */
	async getReasoningTraces(episodeId: string): Promise<any[]> {
		const result = await this.db
			.prepare(
				`
			SELECT * FROM reasoning_traces WHERE episode_id = ? ORDER BY step_number
		`,
			)
			.bind(episodeId)
			.all();

		return result.results.map((row) => ({
			id: row.id,
			episodeId: row.episode_id,
			stepNumber: row.step_number,
			rule: row.rule,
			premises: JSON.parse(row.premises as string),
			conclusion: row.conclusion,
			truthValue: {
				strength: row.truth_strength,
				confidence: row.truth_confidence,
			},
			timestamp: row.timestamp,
		}));
	}

	/**
	 * Store agent execution record
	 */
	async storeAgentExecution(execution: any): Promise<void> {
		await this.db
			.prepare(
				`
			INSERT INTO agent_executions (id, agent_id, agent_type, timestamp, execution_time, atoms_processed, atoms_created, atoms_modified, success, error, metrics)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			)
			.bind(
				execution.id || `${execution.agentId}_${Date.now()}`,
				execution.agentId,
				execution.agentType || "unknown",
				Date.now(),
				execution.executionTime,
				execution.atomsProcessed,
				execution.atomsCreated,
				execution.atomsModified,
				execution.success ? 1 : 0,
				execution.error || null,
				JSON.stringify(execution.metrics || {}),
			)
			.run();
	}

	/**
	 * Get agent execution history
	 */
	async getAgentExecutions(
		agentId?: string,
		limit: number = 100,
	): Promise<any[]> {
		let sql = "SELECT * FROM agent_executions";
		const bindings: any[] = [];

		if (agentId) {
			sql += " WHERE agent_id = ?";
			bindings.push(agentId);
		}

		sql += " ORDER BY timestamp DESC LIMIT ?";
		bindings.push(limit);

		const result = await this.db.prepare(sql).bind(...bindings).all();

		return result.results.map((row) => ({
			id: row.id,
			agentId: row.agent_id,
			agentType: row.agent_type,
			timestamp: row.timestamp,
			executionTime: row.execution_time,
			atomsProcessed: row.atoms_processed,
			atomsCreated: row.atoms_created,
			atomsModified: row.atoms_modified,
			success: row.success === 1,
			error: row.error,
			metrics: JSON.parse((row.metrics as string) || "{}"),
		}));
	}

	/**
	 * Get agent performance statistics
	 */
	async getAgentStats(agentId: string): Promise<any> {
		const result = await this.db
			.prepare(
				`
			SELECT 
				COUNT(*) as total_executions,
				AVG(execution_time) as avg_execution_time,
				SUM(atoms_processed) as total_atoms_processed,
				SUM(atoms_created) as total_atoms_created,
				SUM(atoms_modified) as total_atoms_modified,
				SUM(success) as successful_executions
			FROM agent_executions
			WHERE agent_id = ?
		`,
			)
			.bind(agentId)
			.first();

		return result;
	}

	/**
	 * Clean up old episodes (forgetting)
	 */
	async cleanupOldEpisodes(
		olderThan: number,
		minImportance: number = 50,
	): Promise<number> {
		const result = await this.db
			.prepare(
				`
			DELETE FROM episodes 
			WHERE timestamp < ? AND importance < ?
		`,
			)
			.bind(olderThan, minImportance)
			.run();

		return result.meta.changes;
	}

	/**
	 * Convert database row to Episode
	 */
	private rowToEpisode(row: any): Episode {
		return {
			id: row.id,
			type: row.type as EpisodeType,
			timestamp: row.timestamp,
			duration: row.duration,
			context: JSON.parse(row.context),
			atoms: JSON.parse(row.atoms),
			outcome: row.outcome,
			importance: row.importance,
			tags: JSON.parse(row.tags),
		};
	}
}
