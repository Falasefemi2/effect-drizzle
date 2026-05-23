import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiScalar,
  OpenApi,
} from "effect/unstable/httpapi";
import { HttpRouter, HttpServer } from "effect/unstable/http";
import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { asc, between, count, eq, getColumns, sql } from "drizzle-orm";
import { Effect, Layer, Schema } from "effect";
import { DatabaseLive, PgDrizzle } from "./src/db";
import {
  postsTable,
  usersTable,
  type InsertPost,
  type InsertUser,
  type SelectPost,
  type SelectUser,
} from "./src/db/schema";

console.log("main?", import.meta.main);

const IdParam = Schema.Struct({ id: Schema.NumberFromString });

const PaginationParams = Schema.Struct({
  page: Schema.optional(Schema.NumberFromString),
  pageSize: Schema.optional(Schema.NumberFromString),
});

const User = Schema.Struct({
  id: Schema.Int,
  name: Schema.String,
  age: Schema.Int,
  email: Schema.String,
});

const NewUser = Schema.Struct({
  name: Schema.String,
  age: Schema.Int,
  email: Schema.String,
});

const UserWithPostCount = Schema.Struct({
  id: Schema.Int,
  name: Schema.String,
  age: Schema.Int,
  email: Schema.String,
  postsCount: Schema.Number,
});

const Post = Schema.Struct({
  id: Schema.Int,
  title: Schema.String,
  content: Schema.String,
  userId: Schema.Int,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});

const NewPost = Schema.Struct({
  title: Schema.String,
  content: Schema.String,
  userId: Schema.Int,
});

const UpdatePostPayload = Schema.Struct({
  title: Schema.optional(Schema.String),
  content: Schema.optional(Schema.String),
});

const RecentPost = Schema.Struct({ id: Schema.Int, title: Schema.String });

const toPostResponse = (post: SelectPost): typeof Post.Type => ({
  ...post,
  createdAt: post.createdAt.toISOString(),
  updatedAt: post.updatedAt.toISOString(),
});

const withOrDie = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.orDie);

export const createUsers = (data: InsertUser) =>
  Effect.gen(function* () {
    const drizzle = yield* PgDrizzle;
    return yield* drizzle.insert(usersTable).values(data).returning();
  });

export const createPost = (data: InsertPost) =>
  Effect.gen(function* () {
    const drizzle = yield* PgDrizzle;
    const posts = yield* drizzle.insert(postsTable).values(data).returning();
    return posts.map(toPostResponse);
  });

export const getUserById = (id: SelectUser["id"]) =>
  Effect.gen(function* () {
    const drizzle = yield* PgDrizzle;
    return yield* drizzle
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id));
  });

export const getUserWithPostCount = (page = 1, pageSize = 5) =>
  Effect.gen(function* () {
    const drizzle = yield* PgDrizzle;
    return yield* drizzle
      .select({ ...getColumns(usersTable), postsCount: count(postsTable.id) })
      .from(usersTable)
      .leftJoin(postsTable, eq(usersTable.id, postsTable.userId))
      .groupBy(usersTable.id)
      .orderBy(asc(usersTable.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
  });

export const getPostsForLast24Hours = (page = 1, pageSize = 5) =>
  Effect.gen(function* () {
    const drizzle = yield* PgDrizzle;
    return yield* drizzle
      .select({ id: postsTable.id, title: postsTable.title })
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
  });

export const updatePost = (
  id: SelectPost["id"],
  data: Partial<Pick<SelectPost, "title" | "content">>,
) =>
  Effect.gen(function* () {
    const drizzle = yield* PgDrizzle;
    const posts = yield* drizzle
      .update(postsTable)
      .set(data)
      .where(eq(postsTable.id, id))
      .returning();
    return posts.map(toPostResponse);
  });

export const deleteUser = (id: SelectUser["id"]) =>
  Effect.gen(function* () {
    const drizzle = yield* PgDrizzle;
    return yield* drizzle
      .delete(usersTable)
      .where(eq(usersTable.id, id))
      .returning();
  });

class UsersGroup extends HttpApiGroup.make("users").add(
  HttpApiEndpoint.get("listUsers", "/users", {
    query: PaginationParams,
    success: Schema.Array(UserWithPostCount),
  }),
  HttpApiEndpoint.get("getUser", "/users/:id", {
    params: IdParam,
    success: Schema.Array(User),
  }),
  HttpApiEndpoint.post("createUser", "/users", {
    payload: NewUser,
    success: Schema.Array(User),
  }),
  HttpApiEndpoint.delete("deleteUser", "/users/:id", {
    params: IdParam,
    success: Schema.Array(User),
  }),
) {}

class PostsGroup extends HttpApiGroup.make("posts").add(
  HttpApiEndpoint.post("createPost", "/posts", {
    payload: NewPost,
    success: Schema.Array(Post),
  }),
  HttpApiEndpoint.get("recentPosts", "/posts/recent", {
    query: PaginationParams,
    success: Schema.Array(RecentPost),
  }),
  HttpApiEndpoint.patch("updatePost", "/posts/:id", {
    params: IdParam,
    payload: UpdatePostPayload,
    success: Schema.Array(Post),
  }),
) {}

export class Api extends HttpApi.make("EffectDrizzleApi")
  .add(UsersGroup)
  .add(PostsGroup)
  .annotateMerge(OpenApi.annotations({ title: "Effect Drizzle API" })) {}

export const UsersLive = HttpApiBuilder.group(Api, "users", (handlers) =>
  handlers
    .handle("listUsers", ({ query }) =>
      withOrDie(getUserWithPostCount(query.page ?? 1, query.pageSize ?? 5)),
    )
    .handle("getUser", ({ params }) => withOrDie(getUserById(params.id)))
    .handle("createUser", ({ payload }) => withOrDie(createUsers(payload)))
    .handle("deleteUser", ({ params }) => withOrDie(deleteUser(params.id))),
);

export const PostsLive = HttpApiBuilder.group(Api, "posts", (handlers) =>
  handlers
    .handle("createPost", ({ payload }) => withOrDie(createPost(payload)))
    .handle("recentPosts", ({ query }) =>
      withOrDie(getPostsForLast24Hours(query.page ?? 1, query.pageSize ?? 5)),
    )
    .handle("updatePost", ({ params, payload }) =>
      withOrDie(updatePost(params.id, payload)),
    ),
);

export const ApiLive = HttpApiBuilder.layer(Api, {
  openapiPath: "/openapi.json",
}).pipe(
  Layer.provide(UsersLive),
  Layer.provide(PostsLive),
  Layer.provide(DatabaseLive),
  Layer.provide(HttpApiScalar.layer(Api)),
);

export const HttpLive = HttpRouter.serve(Layer.mergeAll(ApiLive)).pipe(
  HttpServer.withLogAddress,
  Layer.provide(BunHttpServer.layer({ port: 3000 })),
);

if (import.meta.main) {
  BunRuntime.runMain(
    Layer.launch(HttpLive) as Effect.Effect<never, never, never>,
  );
}
