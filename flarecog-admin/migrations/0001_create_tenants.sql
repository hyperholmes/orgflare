-- Migration number: 0001    2025-11-23T09:30:00.000Z
DROP TABLE IF EXISTS tenants;

CREATE TABLE tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tier TEXT NOT NULL CHECK(tier IN ('free', 'pro', 'enterprise')) DEFAULT 'free',
    status TEXT NOT NULL CHECK(status IN ('active', 'suspended', 'deleted')) DEFAULT 'active',
    email TEXT,
    api_key TEXT UNIQUE,
    rate_limit_rpm INTEGER NOT NULL DEFAULT 60,
    rate_limit_burst INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_tenants_updated_at 
    AFTER UPDATE ON tenants
    BEGIN
        UPDATE tenants 
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.id;
    END;

-- Create indexes
CREATE INDEX idx_tenants_tier ON tenants(tier);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_created_at ON tenants(created_at);
