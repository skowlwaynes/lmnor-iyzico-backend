const { neon } = require("@neondatabase/serverless");

let sqlClient;
let schemaPromise;

function getSql() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL tanımlı değil.");
  }

  if (!sqlClient) {
    sqlClient = neon(connectionString);
  }

  return sqlClient;
}

async function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const sql = getSql();

      await sql`
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          status TEXT NOT NULL DEFAULT 'pending_payment',
          payment_status TEXT NOT NULL DEFAULT 'PENDING',
          iyzico_token TEXT,
          payment_id TEXT,
          total_kurus INTEGER NOT NULL CHECK (total_kurus > 0),
          currency TEXT NOT NULL DEFAULT 'TRY',
          items JSONB NOT NULL,
          buyer_name TEXT NOT NULL,
          buyer_surname TEXT NOT NULL,
          buyer_email TEXT NOT NULL,
          buyer_phone TEXT NOT NULL,
          delivery_address TEXT NOT NULL,
          city TEXT NOT NULL,
          country TEXT NOT NULL DEFAULT 'Türkiye',
          zip_code TEXT NOT NULL,
          card_type TEXT,
          card_association TEXT,
          card_family TEXT,
          last_four_digits TEXT,
          failure_code TEXT,
          failure_message TEXT,
          shipping_company TEXT,
          tracking_number TEXT,
          customer_note TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          paid_at TIMESTAMPTZ,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS orders_email_created_idx
        ON orders (LOWER(buyer_email), created_at DESC)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS orders_status_created_idx
        ON orders (status, created_at DESC)
      `;
    })().catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }

  return schemaPromise;
}

async function createPendingOrder(order) {
  await ensureSchema();
  const sql = getSql();

  await sql`
    INSERT INTO orders (
      id,
      status,
      payment_status,
      total_kurus,
      currency,
      items,
      buyer_name,
      buyer_surname,
      buyer_email,
      buyer_phone,
      delivery_address,
      city,
      country,
      zip_code
    ) VALUES (
      ${order.id},
      'pending_payment',
      'PENDING',
      ${order.totalKurus},
      'TRY',
      CAST(${JSON.stringify(order.items)} AS jsonb),
      ${order.buyer.name},
      ${order.buyer.surname},
      ${order.buyer.email.toLowerCase()},
      ${order.buyer.gsmNumber},
      ${order.buyer.address},
      ${order.buyer.city},
      ${order.buyer.country},
      ${order.buyer.zipCode}
    )
  `;
}

async function markCheckoutInitialized(orderId, token) {
  await ensureSchema();
  const sql = getSql();

  await sql`
    UPDATE orders
    SET iyzico_token = ${token},
        status = 'awaiting_payment',
        payment_status = 'PENDING',
        failure_code = NULL,
        failure_message = NULL,
        updated_at = NOW()
    WHERE id = ${orderId}
  `;
}

async function markOrderFailed(orderId, details = {}) {
  await ensureSchema();
  const sql = getSql();

  await sql`
    UPDATE orders
    SET status = CASE WHEN status = 'paid' THEN status ELSE 'payment_failed' END,
        payment_status = CASE WHEN status = 'paid' THEN payment_status ELSE 'FAILURE' END,
        failure_code = ${details.errorCode || null},
        failure_message = ${details.errorMessage || null},
        updated_at = NOW()
    WHERE id = ${orderId}
  `;
}

async function markOrderPaid(orderId, result) {
  await ensureSchema();
  const sql = getSql();

  await sql`
    UPDATE orders
    SET status = 'paid',
        payment_status = 'SUCCESS',
        payment_id = ${String(result.paymentId || "") || null},
        card_type = ${result.cardType || null},
        card_association = ${result.cardAssociation || null},
        card_family = ${result.cardFamily || null},
        last_four_digits = ${result.lastFourDigits || null},
        failure_code = NULL,
        failure_message = NULL,
        paid_at = COALESCE(paid_at, NOW()),
        updated_at = NOW()
    WHERE id = ${orderId}
  `;
}

async function getOrderById(orderId) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT *
    FROM orders
    WHERE id = ${orderId}
    LIMIT 1
  `;
  return rows[0] || null;
}

async function getPublicOrder(orderId, email) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT
      id,
      status,
      payment_status,
      total_kurus,
      currency,
      items,
      shipping_company,
      tracking_number,
      created_at,
      paid_at,
      updated_at
    FROM orders
    WHERE id = ${orderId}
      AND LOWER(buyer_email) = LOWER(${email})
    LIMIT 1
  `;
  return rows[0] || null;
}

async function checkDatabase() {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`SELECT NOW() AS database_time`;
  return rows[0]?.database_time || null;
}

module.exports = {
  ensureSchema,
  createPendingOrder,
  markCheckoutInitialized,
  markOrderFailed,
  markOrderPaid,
  getOrderById,
  getPublicOrder,
  checkDatabase,
};
