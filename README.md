# Effect Drizzle

A modern web application built with the Effect ecosystem and Drizzle ORM, running on Bun.

## Overview

This project demonstrates a type-safe integration between Effect and Drizzle ORM to build a robust REST API. it utilizes @effect/platform for the HTTP server and @effect/sql-pg for PostgreSQL connectivity.

## Technology Stack

- Runtime: Bun
- Language: TypeScript
- Effect Ecosystem:
  - effect: Core functional programming library
  - @effect/platform: HTTP server and routing
  - @effect/sql-pg: PostgreSQL client
  - @effect/language-service: Improved DX and type-checking
- Database:
  - Drizzle ORM: TypeScript ORM for SQL
  - Drizzle Kit: Migration tool and CLI
  - PostgreSQL: Relational database

## Project Structure

- index.ts: Application entry point and API route definitions
- src/db/schema.ts: Database schema definitions using Drizzle
- src/db/index.ts: Database connection and Effect layers
- drizzle.config.ts: Drizzle configuration for migrations
- drizzle/: Database migration files

## Getting Started

### Prerequisites

- Bun installed on your system
- A PostgreSQL database instance

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   bun install
   ```

### Configuration

Set the `DATABASE_URL` environment variable in your shell or a `.env` file:

```bash
DATABASE_URL=postgres://user:password@localhost:5432/dbname
```

### Running the Application

To start the development server:

```bash
bun index.ts
```

The server will be available at http://localhost:3000. API documentation is available at http://localhost:3000/docs.

## Database Management

This project uses Drizzle Kit for schema management and migrations.

### Generate Migrations

If you modify the schema in `src/db/schema.ts`, generate a new migration with:

```bash
bun drizzle-kit generate
```

### Push Schema to Database

To push the schema changes directly to your database:

```bash
bun drizzle-kit push
```

## API Endpoints

### Users

- GET /users: List users with pagination and post counts
- GET /users/:id: Get a specific user by ID
- POST /users: Create a new user
- DELETE /users/:id: Delete a user

### Posts

- POST /posts: Create a new post for a user
- GET /posts/recent: List posts from the last 24 hours with pagination
- PATCH /posts/:id: Update an existing post's title or content

## License

Private