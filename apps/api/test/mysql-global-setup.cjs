const mysql = require("mysql2/promise");

async function dropWorkerDatabases() {
  for (const key of ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD"]) {
    if (!process.env[key])
      throw new Error(`${key} is required to run API tests against MySQL`);
  }
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  try {
    const [rows] = await connection.query(
      "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME REGEXP '^dev_taskory_test_[0-9]+(_[0-9]+_[a-f0-9]{8})?$'",
    );
    for (const { SCHEMA_NAME: name } of rows) {
      if (!/^dev_taskory_test_[0-9]+(?:_[0-9]+_[a-f0-9]{8})?$/.test(name))
        continue;
      await connection.query(`DROP DATABASE \`${name}\``);
    }
  } finally {
    await connection.end();
  }
}

module.exports = dropWorkerDatabases;
