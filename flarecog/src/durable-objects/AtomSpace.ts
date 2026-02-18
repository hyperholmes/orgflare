import { DurableObject } from "cloudflare:workers";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
	Env,
	Atom,
	Node,
	Link,
	AtomType,
	TruthValue,
	AttentionValue,
	AtomSpaceQuery,
	AtomSpaceResponse,
} from "../types/cognitive";

/**
 * AtomSpace Durable Object - Core hypergraph knowledge representation
 *
 * This class implements a simplified version of OpenCog's AtomSpace using
 * Durable Objects for persistent state and distributed coordination.
 */
export class AtomSpace extends DurableObject<Env> {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

	/**
	 * Initialize the AtomSpace with core schema
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
	 * Create a new Node in the AtomSpace
	 */
	async createNode(
		type: Extract<
			AtomType,
			"Node" | "ConceptNode" | "PredicateNode" | "VariableNode"
		>,
		name: string,
		truthValue?: TruthValue,
		attentionValue?: AttentionValue,
	): Promise<Node> {
		const id = nanoid();
		const now = Date.now();
		const tv = truthValue || { strength: 0.5, confidence: 0.5 };
		const av = attentionValue || { sti: 0, lti: 0, vlti: 0 };

		// Check if node with same type and name already exists
		const existing = this.ctx.storage.sql
			.exec(
				`
			SELECT id FROM atoms WHERE type = ? AND name = ?
		`,
				type,
				name,
			)
			.toArray();

		if (existing.length > 0) {
			throw new Error(`Node with type ${type} and name ${name} already exists`);
		}

		await this.ctx.storage.sql.exec(
			`
			INSERT INTO atoms (id, type, name, truth_strength, truth_confidence, sti, lti, vlti, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			id,
			type,
			name,
			tv.strength,
			tv.confidence,
			av.sti,
			av.lti,
			av.vlti,
			now,
			now,
		);

		const node: Node = {
			id,
			type,
			name,
			truthValue: tv,
			attentionValue: av,
			createdAt: now,
			updatedAt: now,
		};

		return node;
	}

	/**
	 * Create a new Link in the AtomSpace
	 */
	async createLink(
		type: Extract<
			AtomType,
			| "Link"
			| "EvaluationLink"
			| "InheritanceLink"
			| "SimilarityLink"
			| "ImplicationLink"
			| "ListLink"
			| "AndLink"
			| "OrLink"
			| "NotLink"
		>,
		outgoing: string[],
		truthValue?: TruthValue,
		attentionValue?: AttentionValue,
	): Promise<Link> {
		if (outgoing.length === 0) {
			throw new Error("Link must have at least one outgoing atom");
		}

		// Verify all outgoing atoms exist
		const placeholders = outgoing.map(() => "?").join(",");
		const existingAtoms = this.ctx.storage.sql
			.exec(
				`
			SELECT id FROM atoms WHERE id IN (${placeholders})
		`,
				...outgoing,
			)
			.toArray();

		if (existingAtoms.length !== outgoing.length) {
			throw new Error("One or more outgoing atoms do not exist");
		}

		const id = nanoid();
		const now = Date.now();
		const tv = truthValue || { strength: 0.5, confidence: 0.5 };
		const av = attentionValue || { sti: 0, lti: 0, vlti: 0 };

		// Create the link atom
		await this.ctx.storage.sql.exec(
			`
			INSERT INTO atoms (id, type, truth_strength, truth_confidence, sti, lti, vlti, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			id,
			type,
			tv.strength,
			tv.confidence,
			av.sti,
			av.lti,
			av.vlti,
			now,
			now,
		);

		// Create the link relationships
		for (let i = 0; i < outgoing.length; i++) {
			await this.ctx.storage.sql.exec(
				`
				INSERT INTO links (id, link_id, target_id, position)
				VALUES (?, ?, ?, ?)
			`,
				nanoid(),
				id,
				outgoing[i],
				i,
			);
		}

		const link: Link = {
			id,
			type,
			outgoing,
			truthValue: tv,
			attentionValue: av,
			createdAt: now,
			updatedAt: now,
		};

		return link;
	}

	/**
	 * Get an atom by ID
	 */
	async getAtom(id: string): Promise<Atom | null> {
		const result = this.ctx.storage.sql
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
			}>(
				`
			SELECT * FROM atoms WHERE id = ?
		`,
				id,
			)
			.toArray();

		if (result.length === 0) {
			return null;
		}

		const row = result[0];
		const atom: Atom = {
			id: row.id,
			type: row.type as AtomType,
			name: row.name || undefined,
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
		};

		// If it's a link, get the outgoing atoms
		if (this.isLinkType(atom.type)) {
			const linkResult = this.ctx.storage.sql
				.exec<{ target_id: string }>(
					`
				SELECT target_id FROM links WHERE link_id = ? ORDER BY position
			`,
					id,
				)
				.toArray();

			(atom as Link).outgoing = linkResult.map((row) => row.target_id);
		}

		return atom;
	}

	/**
	 * Query atoms based on criteria
	 */
	async queryAtoms(query: AtomSpaceQuery): Promise<Atom[]> {
		let sql = "SELECT * FROM atoms WHERE 1=1";
		const params: any[] = [];

		if (query.atomType) {
			sql += " AND type = ?";
			params.push(query.atomType);
		}

		if (query.name) {
			sql += " AND name = ?";
			params.push(query.name);
		}

		if (query.truthValueMin) {
			sql += " AND truth_strength >= ? AND truth_confidence >= ?";
			params.push(query.truthValueMin.strength, query.truthValueMin.confidence);
		}

		if (query.attentionValueMin) {
			sql += " AND sti >= ?";
			params.push(query.attentionValueMin.sti);
		}

		sql += " ORDER BY sti DESC";

		if (query.limit) {
			sql += " LIMIT ?";
			params.push(query.limit);
		}

		if (query.offset) {
			sql += " OFFSET ?";
			params.push(query.offset);
		}

		const result = this.ctx.storage.sql
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
			}>(sql, ...params)
			.toArray();

		const atoms: Atom[] = [];
		for (const atomRow of result) {
			const atom: Atom = {
				id: atomRow.id,
				type: atomRow.type as AtomType,
				name: atomRow.name || undefined,
				truthValue: {
					strength: atomRow.truth_strength,
					confidence: atomRow.truth_confidence,
				},
				attentionValue: {
					sti: atomRow.sti,
					lti: atomRow.lti,
					vlti: atomRow.vlti,
				},
				createdAt: atomRow.created_at,
				updatedAt: atomRow.updated_at,
			};

			// If it's a link, get the outgoing atoms
			if (this.isLinkType(atom.type)) {
				const linkResult = this.ctx.storage.sql
					.exec<{ target_id: string }>(
						`
					SELECT target_id FROM links WHERE link_id = ? ORDER BY position
				`,
						atom.id,
					)
					.toArray();

				(atom as Link).outgoing = linkResult.map(
					(linkRow) => linkRow.target_id,
				);
			}

			atoms.push(atom);
		}

		return atoms;
	}

	/**
	 * Get incoming links for an atom
	 */
	async getIncoming(atomId: string): Promise<Link[]> {
		const result = this.ctx.storage.sql
			.exec<{
				id: string;
				type: string;
				truth_strength: number;
				truth_confidence: number;
				sti: number;
				lti: number;
				vlti: number;
				created_at: number;
				updated_at: number;
			}>(
				`
			SELECT DISTINCT a.* FROM atoms a
			INNER JOIN links l ON a.id = l.link_id
			WHERE l.target_id = ?
		`,
				atomId,
			)
			.toArray();

		const links: Link[] = [];
		for (const atomRow of result) {
			const linkResult = this.ctx.storage.sql
				.exec<{ target_id: string }>(
					`
				SELECT target_id FROM links WHERE link_id = ? ORDER BY position
			`,
					atomRow.id,
				)
				.toArray();

			const link: Link = {
				id: atomRow.id,
				type: atomRow.type as Extract<
					AtomType,
					| "Link"
					| "EvaluationLink"
					| "InheritanceLink"
					| "SimilarityLink"
					| "ImplicationLink"
					| "ListLink"
					| "AndLink"
					| "OrLink"
					| "NotLink"
				>,
				outgoing: linkResult.map((linkRow) => linkRow.target_id),
				truthValue: {
					strength: atomRow.truth_strength,
					confidence: atomRow.truth_confidence,
				},
				attentionValue: {
					sti: atomRow.sti,
					lti: atomRow.lti,
					vlti: atomRow.vlti,
				},
				createdAt: atomRow.created_at,
				updatedAt: atomRow.updated_at,
			};

			links.push(link);
		}

		return links;
	}

	/**
	 * Update an atom's truth or attention values
	 */
	async updateAtom(
		id: string,
		truthValue?: TruthValue,
		attentionValue?: AttentionValue,
	): Promise<boolean> {
		const updates: string[] = [];
		const params: any[] = [];

		if (truthValue) {
			updates.push("truth_strength = ?", "truth_confidence = ?");
			params.push(truthValue.strength, truthValue.confidence);
		}

		if (attentionValue) {
			updates.push("sti = ?", "lti = ?", "vlti = ?");
			params.push(attentionValue.sti, attentionValue.lti, attentionValue.vlti);
		}

		if (updates.length === 0) {
			return false;
		}

		updates.push("updated_at = ?");
		params.push(Date.now());
		params.push(id);

		const result = this.ctx.storage.sql.exec(
			`
			UPDATE atoms SET ${updates.join(", ")} WHERE id = ?
		`,
			...params,
		);

		return result.rowsWritten > 0;
	}

	/**
	 * Delete an atom and all its relationships
	 */
	async deleteAtom(id: string): Promise<boolean> {
		// Delete all links that reference this atom
		this.ctx.storage.sql.exec(
			`
			DELETE FROM links WHERE link_id = ? OR target_id = ?
		`,
			id,
			id,
		);

		// Delete the atom itself
		const result = this.ctx.storage.sql.exec(
			`
			DELETE FROM atoms WHERE id = ?
		`,
			id,
		);

		return result.rowsWritten > 0;
	}

	/**
	 * Get AtomSpace statistics
	 */
	async getStatistics(): Promise<any> {
		const totalAtoms = this.ctx.storage.sql
			.exec<{ count: number }>(
				`
			SELECT COUNT(*) as count FROM atoms
		`,
			)
			.one();

		const nodeCount = this.ctx.storage.sql
			.exec<{ count: number }>(
				`
			SELECT COUNT(*) as count FROM atoms WHERE type LIKE '%Node'
		`,
			)
			.one();

		const linkCount = this.ctx.storage.sql
			.exec<{ count: number }>(
				`
			SELECT COUNT(*) as count FROM atoms WHERE type LIKE '%Link'
		`,
			)
			.one();

		const avgTruthValue = this.ctx.storage.sql
			.exec<{ strength: number | null; confidence: number | null }>(
				`
			SELECT AVG(truth_strength) as strength, AVG(truth_confidence) as confidence FROM atoms
		`,
			)
			.one();

		const avgAttentionValue = this.ctx.storage.sql
			.exec<{ sti: number | null; lti: number | null; vlti: number | null }>(
				`
			SELECT AVG(sti) as sti, AVG(lti) as lti, AVG(vlti) as vlti FROM atoms
		`,
			)
			.one();

		return {
			totalAtoms: totalAtoms.count,
			nodeCount: nodeCount.count,
			linkCount: linkCount.count,
			averageTruthValue: {
				strength: avgTruthValue.strength || 0,
				confidence: avgTruthValue.confidence || 0,
			},
			averageAttentionValue: {
				sti: avgAttentionValue.sti || 0,
				lti: avgAttentionValue.lti || 0,
				vlti: avgAttentionValue.vlti || 0,
			},
		};
	}

	/**
	 * Handle HTTP requests to the AtomSpace
	 */
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		try {
			// Initialize if not already done
			await this.initialize();

			if (request.method === "GET" && path === "/stats") {
				const stats = await this.getStatistics();
				return Response.json({
					success: true,
					data: stats,
					timestamp: Date.now(),
				});
			}

			if (request.method === "GET" && path.startsWith("/atom/")) {
				const atomId = path.split("/")[2];
				const atom = await this.getAtom(atomId);
				return Response.json({
					success: true,
					data: atom,
					timestamp: Date.now(),
				});
			}

			if (request.method === "GET" && path.startsWith("/incoming/")) {
				const atomId = path.split("/")[2];
				const incoming = await this.getIncoming(atomId);
				return Response.json({
					success: true,
					data: incoming,
					timestamp: Date.now(),
				});
			}

				if (request.method === "POST" && path === "/query") {
					const query = (await request.json()) as AtomSpaceQuery;
					
					// Check if this is a pattern match query
					if (query.type === "pattern_match" && query.pattern) {
						// Pattern matching handled by PatternMatcher
						// This would require importing PatternMatcher
						// For now, return empty results with a note
						return Response.json({
							success: true,
							data: [],
							timestamp: Date.now(),
							message: "Pattern matching available via worker API",
						});
					}
					
					const atoms = await this.queryAtoms(query);
					return Response.json({
						success: true,
						data: atoms,
						timestamp: Date.now(),
					});
				}

			if (request.method === "POST" && path === "/node") {
				const body = (await request.json()) as {
					type: Extract<
						AtomType,
						"Node" | "ConceptNode" | "PredicateNode" | "VariableNode"
					>;
					name: string;
					truthValue?: TruthValue;
					attentionValue?: AttentionValue;
				};
				const { type, name, truthValue, attentionValue } = body;
				const node = await this.createNode(
					type,
					name,
					truthValue,
					attentionValue,
				);
				return Response.json({
					success: true,
					data: node,
					timestamp: Date.now(),
				});
			}

			if (request.method === "POST" && path === "/link") {
				const body = (await request.json()) as {
					type: Extract<
						AtomType,
						| "Link"
						| "EvaluationLink"
						| "InheritanceLink"
						| "SimilarityLink"
						| "ImplicationLink"
						| "ListLink"
						| "AndLink"
						| "OrLink"
						| "NotLink"
					>;
					outgoing: string[];
					truthValue?: TruthValue;
					attentionValue?: AttentionValue;
				};
				const { type, outgoing, truthValue, attentionValue } = body;
				const link = await this.createLink(
					type,
					outgoing,
					truthValue,
					attentionValue,
				);
				return Response.json({
					success: true,
					data: link,
					timestamp: Date.now(),
				});
			}

			if (request.method === "PUT" && path.startsWith("/atom/")) {
				const atomId = path.split("/")[2];
				const body = (await request.json()) as {
					truthValue?: TruthValue;
					attentionValue?: AttentionValue;
				};
				const { truthValue, attentionValue } = body;
				const success = await this.updateAtom(
					atomId,
					truthValue,
					attentionValue,
				);
				return Response.json({ success, timestamp: Date.now() });
			}

			if (request.method === "DELETE" && path.startsWith("/atom/")) {
				const atomId = path.split("/")[2];
				const success = await this.deleteAtom(atomId);
				return Response.json({ success, timestamp: Date.now() });
			}

			return Response.json(
				{ success: false, error: "Not found", timestamp: Date.now() },
				{ status: 404 },
			);
		} catch (error) {
			console.error("AtomSpace error:", error);
			return Response.json(
				{
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
					timestamp: Date.now(),
				},
				{ status: 500 },
			);
		}
	}

	/**
	 * Check if an atom type is a link type
	 */
	private isLinkType(type: AtomType): boolean {
		return type.includes("Link");
	}
}
