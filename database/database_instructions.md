# Database Import Instructions

## Prerequisites
- PostgreSQL installed (same version or newer than mine)(mine is postgreSQL 17)
- pgAdmin installed (optional but recommended)

## Import Steps

### Using pgAdmin:
1. Open pgAdmin
2. Create a new database named 'bidmaster'
3. Right-click on the new database
4. Select 'Restore...'
5. Choose the backup file (bidmaster_backup.sql)
6. Select the appropriate format (Custom or Plain) (custom is better)
7. Click 'Restore' to import the database

### Using Command Line:
1. Create a new database:
   psql -U postgres -c "CREATE DATABASE bidmaster;"

2. Import the database:
   # For custom format:
   pg_restore -U postgres -d bidmaster /path/to/bidmaster_backup.sql

   # For plain format:
   psql -U postgres -d bidmaster < /path/to/bidmaster_backup.sql

## Update Connection Settings
Modify the db.js file with your local database credentials:

```javascript
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'bidmaster',
  port: 5432,
  password: 'your_password' // Use your local PostgreSQL password
});