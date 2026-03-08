/**
 * @fileoverview Test Fixtures — Reusable test data factories.
 *
 * Provides deterministic seed functions and data factories for test suites.
 * All fixtures operate on a provided SandboxDb instance, never on production data.
 *
 * @see tests/helpers/sandbox-db.js — Sandbox DB creation
 */

/**
 * Inserts a test customer into the sandbox DB.
 *
 * @param {import('./sandbox-db.js').SandboxDb} db
 * @param {Partial<{cust_name: string, cust_email: string, cust_contact: string}>} overrides
 * @returns {Promise<number>} The inserted cust_id
 */
export const seedCustomer = async (db, overrides = {}) => {
    const data = {
        cust_name: 'Test Kft.',
        cust_email: 'test@example.com',
        cust_contact: 'Teszt Péter',
        ...overrides,
    };
    const result = await db.run(
        'INSERT INTO customers (cust_name, cust_email, cust_contact) VALUES (?, ?, ?)',
        [data.cust_name, data.cust_email, data.cust_contact]
    );
    return result.lastID;
};

/**
 * Inserts a test supplier into the sandbox DB.
 *
 * @param {import('./sandbox-db.js').SandboxDb} db
 * @param {Partial<{prod_supp_co: string, prod_supp_email: string}>} overrides
 * @returns {Promise<number>} The inserted prod_supp_id
 */
export const seedSupplier = async (db, overrides = {}) => {
    const data = {
        prod_supp_co: 'Teszt Szállító Kft.',
        prod_supp_email: 'supplier@example.com',
        ...overrides,
    };
    const result = await db.run(
        'INSERT INTO product_suppliers (prod_supp_co, prod_supp_email) VALUES (?, ?)',
        [data.prod_supp_co, data.prod_supp_email]
    );
    return result.lastID;
};

/**
 * Inserts a test product linked to a supplier into the sandbox DB.
 *
 * @param {import('./sandbox-db.js').SandboxDb} db
 * @param {number} supplierId
 * @param {Partial<{prod_name: string, unit_price: number}>} overrides
 * @returns {Promise<number>} The inserted prod_id
 */
export const seedProduct = async (db, supplierId, overrides = {}) => {
    const data = {
        prod_name: 'Test Widget',
        unit_price: 1000,
        prod_type: 'hardware',
        ...overrides,
    };
    const result = await db.run(
        'INSERT INTO products (prod_name, unit_price, prod_type, prod_supp_id) VALUES (?, ?, ?, ?)',
        [data.prod_name, data.unit_price, data.prod_type, supplierId]
    );
    return result.lastID;
};

/**
 * Seeds a complete usable environment: one customer, one supplier, one product.
 * Returns all IDs for use in tests.
 *
 * @param {import('./sandbox-db.js').SandboxDb} db
 * @returns {Promise<{customerId: number, supplierId: number, productId: number, productPrice: number}>}
 */
export const seedBaseData = async (db) => {
    const supplierId = await seedSupplier(db);
    const customerId = await seedCustomer(db);
    const productPrice = 2500;
    const productId = await seedProduct(db, supplierId, { unit_price: productPrice });
    return { customerId, supplierId, productId, productPrice };
};
