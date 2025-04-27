const { Pool } = require('pg');

// Use a connection pool with a password
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'bidmaster',
  port: 5432,
  // password: 'postgres' // Using the default postgres password
  password: '1985' // Replace with your actual password
});

// Test the connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully at:', res.rows[0].now);
  }
});

module.exports = pool;