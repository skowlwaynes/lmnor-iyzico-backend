const { neon } = require("@neondatabase/serverless");
const { PRODUCT_SEEDS } = require("./catalog");

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
          confirmation_email_claimed_at TIMESTAMPTZ,
          confirmation_email_sent_at TIMESTAMPTZ,
          confirmation_email_id TEXT,
          confirmation_email_error TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          paid_at TIMESTAMPTZ,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmation_email_claimed_at TIMESTAMPTZ`;
      await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmation_email_sent_at TIMESTAMPTZ`;
      await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmation_email_id TEXT`;
      await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmation_email_error TEXT`;

      await sql`
        CREATE INDEX IF NOT EXISTS orders_email_created_idx
        ON orders (LOWER(buyer_email), created_at DESC)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS orders_status_created_idx
        ON orders (status, created_at DESC)
      `;


      await sql`
        CREATE TABLE IF NOT EXISTS order_status_notifications (
          order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          status TEXT NOT NULL,
          claimed_at TIMESTAMPTZ,
          sent_at TIMESTAMPTZ,
          email_id TEXT,
          last_error TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (order_id, status)
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS order_status_notifications_sent_idx
        ON order_status_notifications (sent_at, updated_at DESC)
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          category1 TEXT NOT NULL DEFAULT 'Tişört',
          category2 TEXT,
          regular_price_kurus INTEGER NOT NULL CHECK (regular_price_kurus > 0),
          campaign_price_kurus INTEGER CHECK (campaign_price_kurus > 0),
          campaign_enabled BOOLEAN NOT NULL DEFAULT FALSE,
          campaign_starts_at TIMESTAMPTZ,
          campaign_ends_at TIMESTAMPTZ,
          active BOOLEAN NOT NULL DEFAULT TRUE,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS campaign_price_kurus INTEGER`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS campaign_enabled BOOLEAN NOT NULL DEFAULT FALSE`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS campaign_starts_at TIMESTAMPTZ`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS campaign_ends_at TIMESTAMPTZ`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;

      for (const product of PRODUCT_SEEDS) {
        await sql`
          INSERT INTO products (
            id,
            name,
            category1,
            category2,
            regular_price_kurus,
            active,
            sort_order
          ) VALUES (
            ${product.id},
            ${product.name},
            ${product.category1},
            ${product.category2},
            ${product.regularPriceKurus},
            TRUE,
            ${product.sortOrder}
          )
          ON CONFLICT (id) DO UPDATE
          SET name = EXCLUDED.name,
              category1 = EXCLUDED.category1,
              category2 = EXCLUDED.category2,
              sort_order = EXCLUDED.sort_order
        `;
      }

      await sql`
        CREATE INDEX IF NOT EXISTS products_active_sort_idx
        ON products (active, sort_order, id)
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


async function claimOrderConfirmationEmail(orderId) {
  await ensureSchema();
  const sql = getSql();

  const rows = await sql`
    UPDATE orders
    SET confirmation_email_claimed_at = NOW(),
        confirmation_email_error = NULL,
        updated_at = NOW()
    WHERE id = ${orderId}
      AND status = 'paid'
      AND confirmation_email_sent_at IS NULL
      AND (
        confirmation_email_claimed_at IS NULL
        OR confirmation_email_claimed_at < NOW() - INTERVAL '10 minutes'
      )
    RETURNING *
  `;

  return rows[0] || null;
}

async function markOrderConfirmationEmailSent(orderId, emailId) {
  await ensureSchema();
  const sql = getSql();

  await sql`
    UPDATE orders
    SET confirmation_email_sent_at = COALESCE(confirmation_email_sent_at, NOW()),
        confirmation_email_id = COALESCE(confirmation_email_id, ${emailId || null}),
        confirmation_email_claimed_at = NULL,
        confirmation_email_error = NULL,
        updated_at = NOW()
    WHERE id = ${orderId}
  `;
}

async function markOrderConfirmationEmailFailed(orderId, message) {
  await ensureSchema();
  const sql = getSql();

  await sql`
    UPDATE orders
    SET confirmation_email_claimed_at = NULL,
        confirmation_email_error = ${String(message || "E-posta gönderilemedi.").slice(0, 1000)},
        updated_at = NOW()
    WHERE id = ${orderId}
      AND confirmation_email_sent_at IS NULL
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


async function listAdminOrders({ status = "", search = "", limit = 50 } = {}) {
  await ensureSchema();
  const sql = getSql();
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 50));
  const searchPattern = `%${String(search || "").trim()}%`;

  if (status && search) {
    return sql`
      SELECT *
      FROM orders
      WHERE status = ${status}
        AND (
          id ILIKE ${searchPattern}
          OR buyer_name ILIKE ${searchPattern}
          OR buyer_surname ILIKE ${searchPattern}
          OR buyer_email ILIKE ${searchPattern}
          OR buyer_phone ILIKE ${searchPattern}
          OR tracking_number ILIKE ${searchPattern}
        )
      ORDER BY created_at DESC
      LIMIT ${safeLimit}
    `;
  }

  if (status) {
    return sql`
      SELECT *
      FROM orders
      WHERE status = ${status}
      ORDER BY created_at DESC
      LIMIT ${safeLimit}
    `;
  }

  if (search) {
    return sql`
      SELECT *
      FROM orders
      WHERE id ILIKE ${searchPattern}
        OR buyer_name ILIKE ${searchPattern}
        OR buyer_surname ILIKE ${searchPattern}
        OR buyer_email ILIKE ${searchPattern}
        OR buyer_phone ILIKE ${searchPattern}
        OR tracking_number ILIKE ${searchPattern}
      ORDER BY created_at DESC
      LIMIT ${safeLimit}
    `;
  }

  return sql`
    SELECT *
    FROM orders
    ORDER BY created_at DESC
    LIMIT ${safeLimit}
  `;
}

async function updateOrderByAdmin({
  orderId,
  status,
  shippingCompany = null,
  trackingNumber = null,
}) {
  await ensureSchema();
  const sql = getSql();

  const rows = await sql`
    UPDATE orders
    SET status = ${status},
        shipping_company = CASE
          WHEN ${status} = 'shipped' THEN ${shippingCompany}
          ELSE COALESCE(${shippingCompany}, shipping_company)
        END,
        tracking_number = CASE
          WHEN ${status} = 'shipped' THEN ${trackingNumber}
          ELSE COALESCE(${trackingNumber}, tracking_number)
        END,
        updated_at = NOW()
    WHERE id = ${orderId}
      AND payment_status = 'SUCCESS'
    RETURNING *
  `;

  return rows[0] || null;
}

async function claimOrderStatusEmail(orderId, status) {
  await ensureSchema();
  const sql = getSql();

  await sql`
    INSERT INTO order_status_notifications (
      order_id,
      status
    ) VALUES (
      ${orderId},
      ${status}
    )
    ON CONFLICT (order_id, status) DO NOTHING
  `;

  const rows = await sql`
    UPDATE order_status_notifications
    SET claimed_at = NOW(),
        last_error = NULL,
        updated_at = NOW()
    WHERE order_id = ${orderId}
      AND status = ${status}
      AND sent_at IS NULL
      AND (
        claimed_at IS NULL
        OR claimed_at < NOW() - INTERVAL '10 minutes'
      )
    RETURNING *
  `;

  return rows[0] || null;
}

async function markOrderStatusEmailSent(orderId, status, emailId) {
  await ensureSchema();
  const sql = getSql();

  await sql`
    UPDATE order_status_notifications
    SET sent_at = COALESCE(sent_at, NOW()),
        email_id = COALESCE(email_id, ${emailId || null}),
        claimed_at = NULL,
        last_error = NULL,
        updated_at = NOW()
    WHERE order_id = ${orderId}
      AND status = ${status}
  `;
}

async function markOrderStatusEmailFailed(orderId, status, message) {
  await ensureSchema();
  const sql = getSql();

  await sql`
    UPDATE order_status_notifications
    SET claimed_at = NULL,
        last_error = ${String(message || "E-posta gönderilemedi.").slice(0, 1000)},
        updated_at = NOW()
    WHERE order_id = ${orderId}
      AND status = ${status}
      AND sent_at IS NULL
  `;
}

async function listProducts({ includeInactive = false } = {}) {
  await ensureSchema();
  const sql = getSql();

  if (includeInactive) {
    return sql`
      SELECT
        id, name, category1, category2, regular_price_kurus,
        campaign_price_kurus, campaign_enabled, campaign_starts_at,
        campaign_ends_at, active, sort_order, created_at, updated_at,
        (
          campaign_enabled = TRUE
          AND campaign_price_kurus IS NOT NULL
          AND campaign_price_kurus > 0
          AND campaign_price_kurus < regular_price_kurus
          AND (campaign_starts_at IS NULL OR campaign_starts_at <= NOW())
          AND (campaign_ends_at IS NULL OR campaign_ends_at > NOW())
        ) AS campaign_active,
        CASE
          WHEN campaign_enabled = TRUE
            AND campaign_price_kurus IS NOT NULL
            AND campaign_price_kurus > 0
            AND campaign_price_kurus < regular_price_kurus
            AND (campaign_starts_at IS NULL OR campaign_starts_at <= NOW())
            AND (campaign_ends_at IS NULL OR campaign_ends_at > NOW())
          THEN campaign_price_kurus
          ELSE regular_price_kurus
        END AS effective_price_kurus
      FROM products
      ORDER BY sort_order ASC, id ASC
    `;
  }

  return sql`
    SELECT
      id, name, category1, category2, regular_price_kurus,
      campaign_price_kurus, campaign_enabled, campaign_starts_at,
      campaign_ends_at, active, sort_order, created_at, updated_at,
      (
        campaign_enabled = TRUE
        AND campaign_price_kurus IS NOT NULL
        AND campaign_price_kurus > 0
        AND campaign_price_kurus < regular_price_kurus
        AND (campaign_starts_at IS NULL OR campaign_starts_at <= NOW())
        AND (campaign_ends_at IS NULL OR campaign_ends_at > NOW())
      ) AS campaign_active,
      CASE
        WHEN campaign_enabled = TRUE
          AND campaign_price_kurus IS NOT NULL
          AND campaign_price_kurus > 0
          AND campaign_price_kurus < regular_price_kurus
          AND (campaign_starts_at IS NULL OR campaign_starts_at <= NOW())
          AND (campaign_ends_at IS NULL OR campaign_ends_at > NOW())
        THEN campaign_price_kurus
        ELSE regular_price_kurus
      END AS effective_price_kurus
    FROM products
    WHERE active = TRUE
    ORDER BY sort_order ASC, id ASC
  `;
}

async function updateProductPricing({
  productId,
  regularPriceKurus,
  campaignPriceKurus = null,
  campaignEnabled = false,
  campaignStartsAt = null,
  campaignEndsAt = null,
}) {
  await ensureSchema();
  const sql = getSql();

  const rows = await sql`
    UPDATE products
    SET regular_price_kurus = ${regularPriceKurus},
        campaign_price_kurus = ${campaignPriceKurus},
        campaign_enabled = ${campaignEnabled},
        campaign_starts_at = ${campaignStartsAt},
        campaign_ends_at = ${campaignEndsAt},
        updated_at = NOW()
    WHERE id = ${productId}
    RETURNING *
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
  claimOrderConfirmationEmail,
  markOrderConfirmationEmailSent,
  markOrderConfirmationEmailFailed,
  getOrderById,
  getPublicOrder,
  listAdminOrders,
  updateOrderByAdmin,
  claimOrderStatusEmail,
  markOrderStatusEmailSent,
  markOrderStatusEmailFailed,
  listProducts,
  updateProductPricing,
  checkDatabase,
};
