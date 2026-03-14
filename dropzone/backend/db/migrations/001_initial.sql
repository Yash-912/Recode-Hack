CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price_paise INTEGER NOT NULL,
    image_url VARCHAR(255),
    total_stock INTEGER NOT NULL CHECK (total_stock >= 1),
    drop_time TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) NOT NULL,
    product_id UUID REFERENCES products(id) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('confirmed', 'cancelled', 'refunded')),
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    amount_paise INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

CREATE TABLE IF NOT EXISTS waitlist (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) NOT NULL,
    product_id UUID REFERENCES products(id) NOT NULL,
    position INTEGER NOT NULL,
    notified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_waitlist_product_position ON waitlist(product_id, position);

CREATE TABLE IF NOT EXISTS checkout_attempts (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) NOT NULL,
    product_id UUID REFERENCES products(id) NOT NULL,
    result VARCHAR(50) NOT NULL CHECK (result IN ('confirmed', 'sold_out', 'rate_limited', 'error')),
    latency_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checkout_attempts_created_at ON checkout_attempts(created_at);

CREATE TABLE IF NOT EXISTS inventory_log (
    id SERIAL PRIMARY KEY,
    product_id UUID REFERENCES products(id) NOT NULL,
    operation VARCHAR(50) NOT NULL CHECK (operation IN ('seed', 'decrement', 'reset')),
    old_value INTEGER,
    new_value INTEGER NOT NULL,
    triggered_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
