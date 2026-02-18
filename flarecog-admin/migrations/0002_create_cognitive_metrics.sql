-- Migration number: 0002    2025-11-23T09:31:00.000Z
DROP TABLE IF EXISTS cognitive_metrics;

CREATE TABLE cognitive_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    atoms_created INTEGER NOT NULL DEFAULT 0,
    atoms_queried INTEGER NOT NULL DEFAULT 0,
    inferences_performed INTEGER NOT NULL DEFAULT 0,
    agents_executed INTEGER NOT NULL DEFAULT 0,
    ai_calls_made INTEGER NOT NULL DEFAULT 0,
    response_time_ms INTEGER NOT NULL DEFAULT 0,
    success INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Create indexes for efficient querying
CREATE INDEX idx_cognitive_metrics_tenant_timestamp ON cognitive_metrics(tenant_id, timestamp);
CREATE INDEX idx_cognitive_metrics_timestamp ON cognitive_metrics(timestamp);
CREATE INDEX idx_cognitive_metrics_tenant_created ON cognitive_metrics(tenant_id, created_at);
