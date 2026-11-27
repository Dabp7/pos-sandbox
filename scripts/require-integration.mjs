if (!process.env.TEST_DATABASE_URL) {
  console.error(
    "TEST_DATABASE_URL es obligatorio para test:integration. Use una base PostgreSQL de prueba.",
  );
  process.exit(1);
}
