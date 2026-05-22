import { Effect } from "effect";
import { PgDrizzle } from "./src/db";
import {
  postsTable,
  usersTable,
  type InsertPost,
  type InsertUser,
  type SelectPost,
  type SelectUser,
} from "./src/db/schema";
import { asc, between, count, eq, getColumns, sql } from "drizzle-orm";

const createUsers = (data: InsertUser) =>
  Effect.gen(function* () {
    const drizlle = yield* PgDrizzle;
    const users = yield* drizlle.insert(usersTable).values(data);
    return users;
  });

const createPost = (data: InsertPost) =>
  Effect.gen(function* () {
    const drizlle = yield* PgDrizzle;
    const posts = yield* drizlle.insert(postsTable).values(data);
    return posts;
  });

const getUserById = (id: SelectUser["id"]) =>
  Effect.gen(function* () {
    const drizzle = yield* PgDrizzle;
    const userId = drizzle
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id));
    return userId;
  });

const getUserWithPostCound = (page = 1, pageSize = 5) =>
  Effect.gen(function* () {
    const drizzle = yield* PgDrizzle;
    const userCount = drizzle
      .select({
        ...getColumns(usersTable),
        postsCount: count(postsTable.id),
      })
      .from(usersTable)
      .leftJoin(postsTable, eq(usersTable.id, postsTable.userId))
      .groupBy(usersTable.id)
      .orderBy(asc(usersTable.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    return userCount;
  });

const getPostsForLat24Hours = (page = 1, pageSize = 5) =>
  Effect.gen(function* () {
    const drizzle = yield* PgDrizzle;
    const posts = drizzle
      .select({
        id: postsTable.id,
        title: postsTable.title,
      })
      .from(postsTable)
      .where(
        between(
          postsTable.createdAt,
          sql`now() - interval '1 day'`,
          sql`now()`,
        ),
      )
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    return posts;
  });

const updatePost = (
  id: SelectPost["id"],
  data: Partial<Omit<SelectPost, "id">>,
) =>
  Effect.gen(function* () {
    const drizzle = yield* PgDrizzle;
    const post = drizzle
      .update(postsTable)
      .set(data)
      .where(eq(postsTable.id, id));
    return post;
  });

const deleteUser = (id: SelectUser["id"]) =>
  Effect.gen(function* () {
    const drizzle = yield* PgDrizzle;
    return drizzle.delete(usersTable).where(eq(usersTable.id, id));
  });

