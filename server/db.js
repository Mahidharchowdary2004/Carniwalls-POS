require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { Pool } = require('pg');
const dns = require('dns');
const url = require('url');

console.log('🔌 Initializing Database Connection...');

// Force use of a reliable DNS server for deep subdomains
dns.setServers(['8.8.8.8', '1.1.1.1']);

const dbUrl = new url.URL(process.env.DATABASE_URL);
const originalHost = dbUrl.hostname;

// Pre-resolve the DNS because Node/Windows has issues with deep subdomains
let resolvedIp = originalHost;

async function getPool() {
  try {
    const addresses = await new Promise((resolve, reject) => {
      dns.resolve4(originalHost, (err, addr) => err ? reject(err) : resolve(addr));
    });
    resolvedIp = addresses[0];
    console.log(`✅ DNS Pre-resolved: ${originalHost} -> ${resolvedIp}`);
  } catch (err) {
    console.warn(`⚠️ DNS pre-resolve failed for ${originalHost}, using hostname directly: ${err.message}`);
  }

  const config = {
    user: dbUrl.username,
    password: dbUrl.password,
    host: resolvedIp,
    database: dbUrl.pathname.split('/')[1],
    port: dbUrl.port || 5432,
    ssl: {
      rejectUnauthorized: false,
      servername: originalHost // Critical for Neon routing
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };

  const pool = new Pool(config);

  // CRITICAL: Handle unexpected pool errors to prevent process crash
  pool.on('error', (err) => {
    console.error('❌ Unexpected error on idle client', err);
    // Don't exit, the pool will handle reconnecting
  });

  return pool;
}

// Since we need to export a pool-like object immediately, we'll wrap the query method
let internalPool = null;
let poolPromise = null;

const initializePool = () => {
  if (!poolPromise) {
    poolPromise = getPool().then(p => { 
      internalPool = p; 
      return p; 
    }).catch(err => {
      console.error('❌ Failed to initialize database pool:', err);
      poolPromise = null; // Allow retry on next query
      throw err;
    });
  }
  return poolPromise;
};

module.exports = {
  query: async (text, params) => {
    try {
      await initializePool();
      return await internalPool.query(text, params);
    } catch (err) {
      if (err.code === 'ECONNRESET' || err.code === '57P01') {
        console.warn('🔄 Connection reset detected, retrying query...');
        // Small delay and retry once
        await new Promise(r => setTimeout(r, 500));
        internalPool = null; poolPromise = null; // Reset pool
        await initializePool();
        return await internalPool.query(text, params);
      }
      throw err;
    }
  },
  pool: {
    connect: async () => {
      await initializePool();
      return internalPool.connect();
    }
  }
};
