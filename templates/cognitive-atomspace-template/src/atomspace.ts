import { DurableObject } from "cloudflare:workers";
import { nanoid } from "nanoid";
import type {
	Atom,
	Node,
	Link,
	AtomType,
	TruthValue,
	AttentionValue,
	AtomSpaceQuery,
	AtomSpaceStats,
} from "./types";

/**
 * AtomSpace Durable Object
 * 
 * Implements OpenCog's AtomSpace as a hypergraph knowledge representation
 * using Cloudflare Durable Objects for persistence and coordination.
 */
export class AtomSpace extends DurableObject {
	/**
	 * Initialize database schema
	 */
	async initialize(): Promise<void> {
		await this.ctx.storage.sql.exec(`
			CREATE TABLE IF NOT EXISTS atoms (
				id TEXT PRIMARY KEY,
				type TEXT NOT NULL,
				name TEXT,
				truth_strength REAL NOT NULL DEFAULT 0.5,
				truth_confidence REAL NOT NULL DEFAULT 0.5,
				sti INTEGER NOT NULL DEFAULT 0,
				lti INTEGER NOT NULL DEFAULT 0,
				vlti INTEGER NOT NULL DEFAULT 0,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL
			);

			CREATE TABLE IF NOT EXISTS links (
				id TEXT PRIMARY KEY,
				link_id TEXT NOT NULL,
				target_id TEXT NOT NULL,
				position INTEGER NOT NULL,
				FOREIGN KEY (link_id) REFERENCES atoms(id),
				FOREIGN KEY (target_id) REFERENCES atoms(id)
			);

			CREATE INDEX IF NOT EXISTS idx_atoms_type ON atoms(type);
			CREATE INDEX IF NOT EXISTS idx_atoms_name ON atoms(name);
			CREATE INDEX IF NOT EXISTS idx_atoms_sti ON atoms(sti);
			CREATE INDEX IF NOT EXISTS idx_links_link_id ON links(link_id);
			CREATE INDEX IF NOT EXISTS idx_links_target_id ON links(target_id);
		`);
	}

	/**
	 * Create a new Node
	 */
	async createNode(
		type: Extract<AtomType, "Node" | "ConceptNode" | "PredicateNode" | "VariableNode">,
		name: string,
		truthValue?: TruthValue,
		attentionValue?: AttentionValue
	): Promise<Node> {
		const id = nanoid();
		const now = Date.now();
		const tv = truthValue || { strength: 0.5, confidence: 0.5 };
		const av = attentionValue || { sti: 0, lti: 0, vlti: 0 };

		// Check if node already exists
		const existing = await this.ctx.storage.sql
			.exec<{ id: string }>(
				`SELECT id FROM atoms WHERE type = ? AND name = ?`,
				type,
				name
			)
			.toArray();

		if (existing.length > 0) {
			throw new Error(`Node with type ${type} and name ${name} already exists`);
		}

		await this.ctx.storage.sql.exec(
			`INSERT INTO atoms (id, type, name, truth_strength, truth_confidence, sti, lti, vlti, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			id,
			type,
			name,
			tv.strength,
			tv.confidence,
			av.sti,
			av.lti,
			av.vlti,
			now,
			now
		);

		return {
			id,
			type,
			name,
			truthValue: tv,
			attentionValue: av,
			createdAt: now,
			updatedAt: now,
		};
	}

	/**
	 * Create a new Link
	 */
	async createLink(
		type: Extract<
			AtomType,
			"Link" | "EvaluationLink" | "InheritanceLink" | "SimilarityLink" | "ImplicationLink" | "ListLink"
		>,
		outgoing: string[],
		truthValue?: TruthValue,
		attentionValue?: AttentionValue
	): Promise<Link> {
		if (outgoing.length === 0) {
			throw new Error("Link must have at least one outgoing atom");
		}

		const id = nanoid();
		const now = Date.now();
		const tv = truthValue || { strength: 0.5, confidence: 0.5 };
		const av = attentionValue || { sti: 0, lti: 0, vlti: 0 };

		// Verify all outgoing atoms exist
		const placeholders = outgoing.map(() => "?").join(",");
		const existingAtoms = await this.ctx.storage.sql
			.exec<{ id: string }>(
				`SELECT id FROM atoms WHERE id IN (${placeholders})`,
				...outgoing
			)
			.toArray();

		if (existingAtoms.length !== outgoing.length) {
			throw new Error("One or more outgoing atoms do not exist");
		}

		// Create link atom
		await this.ctx.storage.sql.exec(
			`INSERT INTO atoms (id, type, truth_strength, truth_confidence, sti, lti, vlti, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			id,
			type,
			tv.strength,
			tv.confidence,
			av.sti,
			av.lti,
			av.vlti,
			now,
			now
		);

		// Create link connections
		for (let i = 0; i < outgoing.length; i++) {
			await this.ctx.storage.sql.exec(
				`INSERT INTO links (id, link_id, target_id, position) VALUES (?, ?, ?, ?)`,
				nanoid(),
				id,
				outgoing[i],
				i
			);
		}

		return {
			id,
			type,
			outgoing,
			truthValue: tv,
			attentionValue: av,
			createdAt: now,
			updatedAt: now,
		};
	}

	/**
	 * Get atom by ID
	 */
	async getAtom(id: string): Promise<Atom | null> {
		const atom = await this.ctx.storage.sql
			.exec<{
				id: string;
				type: string;
				name: string | null;
				truth_strength: number;
				truth_confidence: number;
				sti: number;
				lti: number;
				vlti: number;
				created_at: number;
				updated_at: number;
			}>(`SELECT * FROM atoms WHERE id = ?`, id)
			.toArray();

		if (atom.length === 0) return null;

		const row = atom[0];

		// Check if it's a link by looking for outgoing connections
		const links = await this.ctx.storage.sql
			.exec<{ target_id: string; position: number }>(
				`SELECT target_id, position FROM links WHERE link_id = ? ORDER BY position`,
				id
			)
			.toArray();

		if (links.length > 0) {
			return {
				id: row.id,
				type: row.type as AtomType,
				outgoing: links.map((l) => l.target_id),
				truthValue: {
					strength: row.truth_strength,
					confidence: row.truth_confidence,
				},
				attentionValue: {
					sti: row.sti,
					lti: row.lti,
					vlti: row.vlti,
				},
				createdAt: row.created_at,
				updatedAt: row.updated_at,
			} as Link;
		}

		return {
			id: row.id,
			type: row.type as AtomType,
			name: row.name!,
			truthValue: {
				strength: row.truth_strength,
				confidence: row.truth_confidence,
			},
			attentionValue: {
				sti: row.sti,
				lti: row.lti,
				vlti: row.vlti,
			},
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		} as Node;
	}

	/**
	 * Query atoms
	 */
	async queryAtoms(query: AtomSpaceQuery): Promise<Atom[]> {
		let sql = "SELECT id FROM atoms WHERE 1=1";
		const params: (string | number)[] = [];

		if (query.type) {
			sql += " AND type = ?";
			params.push(query.type);
		}

		if (query.name) {
			sql += " AND name = ?";
			params.push(query.name);
		}

		if (query.minSTI !== undefined) {
			sql += " AND sti >= ?";
			params.push(query.minSTI);
		}

		if (query.maxSTI !== undefined) {
			sql += " AND sti <= ?";
			params.push(query.maxSTI);
		}

		if (query.minStrength !== undefined) {
			sql += " AND truth_strength >= ?";
			params.push(query.minStrength);
		}

		if (query.maxStrength !== undefined) {
			sql += " AND truth_strength <= ?";
			params.push(query.maxStrength);
		}

		if (query.limit) {
			sql += " LIMIT ?";
			params.push(query.limit);
		}

		const results = await this.ctx.storage.sql
			.exec<{ id: string }>(sql, ...params)
			.toArray();

		const atoms: Atom[] = [];
		for (const row of results) {
			const atom = await this.getAtom(row.id);
			if (atom) atoms.push(atom);
		}

		return atoms;
	}

	/**
	 * Get statistics
	 */
	async getStats(): Promise<AtomSpaceStats> {
		const stats = await this.ctx.storage.sql
			.exec<{
				total: number;
				nodes: number;
				avg_sti: number;
				avg_strength: number;
			}>(
				`SELECT 
					COUNT(*) as total,
					SUM(CASE WHEN name IS NOT NULL THEN 1 ELSE 0 END) as nodes,
					AVG(sti) as avg_sti,
					AVG(truth_strength) as avg_strength
				FROM atoms`
			)
			.toArray();

		const row = stats[0];
		return {
			totalAtoms: row.total,
			nodeCount: row.nodes,
			linkCount: row.total - row.nodes,
			averageSTI: row.avg_sti,
			averageTruthStrength: row.avg_strength,
		};
	}

	/**
	 * Handle HTTP requests
	 */
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		try {
			// Initialize on first request
			if (!this.ctx.storage.sql) {
				return new Response("Storage not available", { status: 500 });
			}

			await this.initialize();

			// Route handlers
			if (path === "/node" && request.method === "POST") {
				const body = await request.json<{
					type: string;
					name: string;
					truthValue?: TruthValue;
					attentionValue?: AttentionValue;
				}>();
				const node = await this.createNode(
					body.type as any,
					body.name,
					body.truthValue,
					body.attentionValue
				);
				return Response.json({ success: true, data: node });
			}

			if (path === "/link" && request.method === "POST") {
				const body = await request.json<{
					type: string;
					outgoing: string[];
					truthValue?: TruthValue;
					attentionValue?: AttentionValue;
				}>();
				const link = await this.createLink(
					body.type as any,
					body.outgoing,
					body.truthValue,
					body.attentionValue
				);
				return Response.json({ success: true, data: link });
			}

			if (path.startsWith("/atom/") && request.method === "GET") {
				const id = path.split("/")[2];
				const atom = await this.getAtom(id);
				if (!atom) {
					return new Response("Atom not found", { status: 404 });
				}
				return Response.json({ success: true, data: atom });
			}

			if (path === "/query" && request.method === "POST") {
				const query = await request.json<AtomSpaceQuery>();
				const atoms = await this.queryAtoms(query);
				return Response.json({ success: true, data: atoms });
			}

			if (path === "/stats" && request.method === "GET") {
				const stats = await this.getStats();
				return Response.json({ success: true, data: stats });
			}

			return new Response("Not found", { status: 404 });
		} catch (error) {
			return Response.json(
				{
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
				},
				{ status: 500 }
			);
		}
	}
}
