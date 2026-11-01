// Base de test dédiée : jamais la base de travail.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://postgres@localhost/leadfinder_test?host=/tmp';
process.env.DEMO_SOURCE_ENABLED = 'true';
process.env.ALLOW_PRIVATE_FETCH = 'true';
process.env.CRAWL_DELAY_MS = '0';
process.env.OSM_MIN_INTERVAL_MS = '0';
process.env.GOOGLE_PLACES_ENABLED = 'true';
process.env.GOOGLE_PLACES_API_KEY = 'test-key-never-sent';
process.env.GOOGLE_PLACES_COST_PER_REQUEST = '0.035';
process.env.PORT = process.env.PORT ?? '18080';
