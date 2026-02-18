-- Migration number: 0003    2025-11-23T09:32:00.000Z
DROP TABLE IF EXISTS billing_events;
DROP TABLE IF EXISTS subscription_tiers;

-- Subscription tiers definition
CREATE TABLE subscription_tiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    price_monthly INTEGER NOT NULL,
    price_yearly INTEGER NOT NULL,
    atoms_limit INTEGER NOT NULL DEFAULT -1,
    inferences_limit INTEGER NOT NULL DEFAULT -1,
    ai_calls_limit INTEGER NOT NULL DEFAULT -1,
    rate_limit_rpm INTEGER NOT NULL DEFAULT 60,
    rate_limit_burst INTEGER NOT NULL DEFAULT 100,
    features TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Billing events table
CREATE TABLE billing_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK(event_type IN ('subscription_created', 'subscription_upgraded', 'subscription_downgraded', 'subscription_cancelled', 'payment_succeeded', 'payment_failed', 'usage_recorded')),
    amount INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    timestamp INTEGER NOT NULL,
    metadata TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Create triggers
CREATE TRIGGER update_subscription_tiers_updated_at 
    AFTER UPDATE ON subscription_tiers
    BEGIN
        UPDATE subscription_tiers 
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.id;
    END;

-- Create indexes
CREATE INDEX idx_billing_events_tenant_timestamp ON billing_events(tenant_id, timestamp);
CREATE INDEX idx_billing_events_event_type ON billing_events(event_type);
CREATE INDEX idx_billing_events_timestamp ON billing_events(timestamp);

-- Insert default subscription tiers
INSERT INTO subscription_tiers (name, description, price_monthly, price_yearly, atoms_limit, inferences_limit, ai_calls_limit, rate_limit_rpm, rate_limit_burst, features) VALUES
('free', 'Free tier for testing and development', 0, 0, 1000, 100, 100, 60, 100, '["basic_atomspace", "basic_reasoning", "community_support"]'),
('pro', 'Professional tier for production use', 4900, 49000, 100000, 10000, 10000, 600, 1000, '["advanced_atomspace", "advanced_reasoning", "ai_enhanced_perception", "priority_support", "analytics_dashboard"]'),
('enterprise', 'Enterprise tier for large-scale deployments', 29900, 299000, -1, -1, -1, 6000, 10000, '["unlimited_atomspace", "unlimited_reasoning", "unlimited_ai_calls", "custom_workflows", "dedicated_support", "sla_guarantee", "custom_integrations"]');
