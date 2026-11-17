# API

Run `npm start` to start the compiled API; in production it applies pending TypeORM migrations before serving requests.

The initial migration targets a fresh database; it does not upgrade databases previously created with TypeORM `synchronize`. Reverting the initial migration drops all tables.
