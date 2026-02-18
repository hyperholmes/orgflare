/**
 * WebSocket Streaming for Real-Time Cognitive Updates
 * 
 * Provides real-time streaming of cognitive events, reasoning processes,
 * and AtomSpace changes to connected clients.
 */

import { Env, Atom, TruthValue } from "../types/cognitive";

export type CognitiveEventType =
	| "atom_created"
	| "atom_updated"
	| "atom_deleted"
	| "reasoning_step"
	| "attention_shift"
	| "goal_achieved"
	| "pattern_matched"
	| "inference_complete"
	| "sync_event";

export interface CognitiveEvent {
	type: CognitiveEventType;
	timestamp: number;
	data: any;
	instanceId: string;
}

export interface AtomCreatedEvent extends CognitiveEvent {
	type: "atom_created";
	data: {
		atom: Atom;
	};
}

export interface AtomUpdatedEvent extends CognitiveEvent {
	type: "atom_updated";
	data: {
		atomId: string;
		oldTruthValue: TruthValue;
		newTruthValue: TruthValue;
	};
}

export interface ReasoningStepEvent extends CognitiveEvent {
	type: "reasoning_step";
	data: {
		step: number;
		rule: string;
		premises: string[];
		conclusion: string;
		truthValue: TruthValue;
	};
}

export interface AttentionShiftEvent extends CognitiveEvent {
	type: "attention_shift";
	data: {
		atomId: string;
		oldSTI: number;
		newSTI: number;
		reason: string;
	};
}

export interface ClientSubscription {
	clientId: string;
	eventTypes: CognitiveEventType[];
	filters?: {
		instanceId?: string;
		atomTypes?: string[];
		minSTI?: number;
	};
}

/**
 * Cognitive WebSocket Manager
 * 
 * Manages WebSocket connections for real-time cognitive event streaming.
 * Uses Durable Objects for connection state management.
 */
export class CognitiveWebSocketManager extends DurableObject<Env> {
	private connections: Map<string, WebSocket>;
	private subscriptions: Map<string, ClientSubscription>;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.connections = new Map();
		this.subscriptions = new Map();
	}

	/**
	 * Handle WebSocket upgrade request
	 */
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/ws") {
			// WebSocket upgrade
			const upgradeHeader = request.headers.get("Upgrade");
			if (upgradeHeader !== "websocket") {
				return new Response("Expected WebSocket", { status: 426 });
			}

			const webSocketPair = new WebSocketPair();
			const [client, server] = Object.values(webSocketPair);

			this.ctx.acceptWebSocket(server);

			const clientId = crypto.randomUUID();
			this.connections.set(clientId, server);

			// Send welcome message
			server.send(
				JSON.stringify({
					type: "connected",
					clientId,
					timestamp: Date.now(),
				}),
			);

			return new Response(null, {
				status: 101,
				webSocket: client,
			});
		}

		if (url.pathname === "/broadcast") {
			// Broadcast event to all connected clients
			const event = (await request.json()) as CognitiveEvent;
			await this.broadcastEvent(event);
			return new Response(JSON.stringify({ success: true }));
		}

		return new Response("Not found", { status: 404 });
	}

	/**
	 * Handle WebSocket messages
	 */
	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
		try {
			const data = JSON.parse(message as string);

			if (data.type === "subscribe") {
				await this.handleSubscribe(ws, data);
			} else if (data.type === "unsubscribe") {
				await this.handleUnsubscribe(ws, data);
			} else if (data.type === "ping") {
				ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
			}
		} catch (error) {
			console.error("WebSocket message error:", error);
			ws.send(
				JSON.stringify({
					type: "error",
					message: "Invalid message format",
				}),
			);
		}
	}

	/**
	 * Handle WebSocket close
	 */
	async webSocketClose(
		ws: WebSocket,
		code: number,
		reason: string,
		wasClean: boolean,
	) {
		// Find and remove the connection
		for (const [clientId, connection] of this.connections.entries()) {
			if (connection === ws) {
				this.connections.delete(clientId);
				this.subscriptions.delete(clientId);
				console.log(`Client ${clientId} disconnected`);
				break;
			}
		}
	}

	/**
	 * Handle WebSocket error
	 */
	async webSocketError(ws: WebSocket, error: Error) {
		console.error("WebSocket error:", error);
	}

	/**
	 * Handle subscription request
	 */
	private async handleSubscribe(ws: WebSocket, data: any) {
		const clientId = this.getClientId(ws);
		if (!clientId) return;

		const subscription: ClientSubscription = {
			clientId,
			eventTypes: data.eventTypes || [],
			filters: data.filters,
		};

		this.subscriptions.set(clientId, subscription);

		ws.send(
			JSON.stringify({
				type: "subscribed",
				subscription,
				timestamp: Date.now(),
			}),
		);
	}

	/**
	 * Handle unsubscribe request
	 */
	private async handleUnsubscribe(ws: WebSocket, data: any) {
		const clientId = this.getClientId(ws);
		if (!clientId) return;

		this.subscriptions.delete(clientId);

		ws.send(
			JSON.stringify({
				type: "unsubscribed",
				timestamp: Date.now(),
			}),
		);
	}

	/**
	 * Broadcast event to subscribed clients
	 */
	private async broadcastEvent(event: CognitiveEvent) {
		for (const [clientId, subscription] of this.subscriptions.entries()) {
			if (this.shouldSendEvent(event, subscription)) {
				const ws = this.connections.get(clientId);
				if (ws) {
					try {
						ws.send(JSON.stringify(event));
					} catch (error) {
						console.error(`Failed to send to client ${clientId}:`, error);
					}
				}
			}
		}
	}

	/**
	 * Check if event should be sent to client
	 */
	private shouldSendEvent(
		event: CognitiveEvent,
		subscription: ClientSubscription,
	): boolean {
		// Check event type filter
		if (
			subscription.eventTypes.length > 0 &&
			!subscription.eventTypes.includes(event.type)
		) {
			return false;
		}

		// Check instance filter
		if (
			subscription.filters?.instanceId &&
			event.instanceId !== subscription.filters.instanceId
		) {
			return false;
		}

		// Check atom type filter
		if (
			subscription.filters?.atomTypes &&
			event.data.atom &&
			!subscription.filters.atomTypes.includes(event.data.atom.type)
		) {
			return false;
		}

		// Check STI filter
		if (
			subscription.filters?.minSTI !== undefined &&
			event.data.atom &&
			event.data.atom.attentionValue.sti < subscription.filters.minSTI
		) {
			return false;
		}

		return true;
	}

	/**
	 * Get client ID from WebSocket
	 */
	private getClientId(ws: WebSocket): string | null {
		for (const [clientId, connection] of this.connections.entries()) {
			if (connection === ws) {
				return clientId;
			}
		}
		return null;
	}

	/**
	 * Get connection statistics
	 */
	async getStats(): Promise<{
		totalConnections: number;
		totalSubscriptions: number;
		subscriptionsByType: Record<CognitiveEventType, number>;
	}> {
		const subscriptionsByType: Record<string, number> = {};

		for (const subscription of this.subscriptions.values()) {
			for (const eventType of subscription.eventTypes) {
				subscriptionsByType[eventType] =
					(subscriptionsByType[eventType] || 0) + 1;
			}
		}

		return {
			totalConnections: this.connections.size,
			totalSubscriptions: this.subscriptions.size,
			subscriptionsByType: subscriptionsByType as Record<
				CognitiveEventType,
				number
			>,
		};
	}
}

/**
 * Event Publisher - Helper for publishing events to WebSocket manager
 */
export class CognitiveEventPublisher {
	constructor(private env: Env) {}

	/**
	 * Publish atom created event
	 */
	async publishAtomCreated(atom: Atom, instanceId: string): Promise<void> {
		const event: AtomCreatedEvent = {
			type: "atom_created",
			timestamp: Date.now(),
			instanceId,
			data: { atom },
		};

		await this.publishEvent(event);
	}

	/**
	 * Publish atom updated event
	 */
	async publishAtomUpdated(
		atomId: string,
		oldTruthValue: TruthValue,
		newTruthValue: TruthValue,
		instanceId: string,
	): Promise<void> {
		const event: AtomUpdatedEvent = {
			type: "atom_updated",
			timestamp: Date.now(),
			instanceId,
			data: { atomId, oldTruthValue, newTruthValue },
		};

		await this.publishEvent(event);
	}

	/**
	 * Publish reasoning step event
	 */
	async publishReasoningStep(
		step: number,
		rule: string,
		premises: string[],
		conclusion: string,
		truthValue: TruthValue,
		instanceId: string,
	): Promise<void> {
		const event: ReasoningStepEvent = {
			type: "reasoning_step",
			timestamp: Date.now(),
			instanceId,
			data: { step, rule, premises, conclusion, truthValue },
		};

		await this.publishEvent(event);
	}

	/**
	 * Publish attention shift event
	 */
	async publishAttentionShift(
		atomId: string,
		oldSTI: number,
		newSTI: number,
		reason: string,
		instanceId: string,
	): Promise<void> {
		const event: AttentionShiftEvent = {
			type: "attention_shift",
			timestamp: Date.now(),
			instanceId,
			data: { atomId, oldSTI, newSTI, reason },
		};

		await this.publishEvent(event);
	}

	/**
	 * Publish generic cognitive event
	 */
	private async publishEvent(event: CognitiveEvent): Promise<void> {
		try {
			// Get WebSocket manager instance
			const wsManagerId = this.env.WS_MANAGER.idFromName("global");
			const wsManager = this.env.WS_MANAGER.get(wsManagerId);

			// Send event to WebSocket manager
			await wsManager.fetch(
				new Request("http://dummy/broadcast", {
					method: "POST",
					body: JSON.stringify(event),
					headers: { "Content-Type": "application/json" },
				}),
			);
		} catch (error) {
			console.error("Failed to publish event:", error);
		}
	}
}
