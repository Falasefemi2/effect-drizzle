import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiScalar,
  HttpMiddleware,
  HttpServer,
} from "@effect/platform";
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

const IdParam = Schema.Struct({
  id: Schema.NumberFromString,
});

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

const RecentPost = Schema.Struct({
  id: Schema.Int,
  title: Schema.String,
});

const toApiError = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const toPostResponse = (post: SelectPost): typeof Post.Type => ({
  ...post,
  createdAt: post.createdAt.toISOString(),
  updatedAt: post.updatedAt.toISOString(),
});

const withApiError = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.mapError(toApiError));

export const createUsers = (data: InsertUser) =>
  Effect.gen(function* () {
    const drizzle = yield* PgDrizzle;
    const users = yield* drizzle.insert(usersTable).values(data).returning();
    return users;
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
    const users = yield* drizzle
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id));
    return users;
  });

export const getUserWithPostCount = (page = 1, pageSize = 5) =>
  Effect.gen(function* () {
    const drizzle = yield* PgDrizzle;
    const users = yield* drizzle
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
    return users;
  });

export const getPostsForLast24Hours = (page = 1, pageSize = 5) =>
  Effect.gen(function* () {
    const drizzle = yield* PgDrizzle;
    const posts = yield* drizzle
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
    const users = yield* drizzle
      .delete(usersTable)
      .where(eq(usersTable.id, id))
      .returning();
    return users;
  });

export const Api = HttpApi.make("EffectDrizzleApi")
  .addError(Schema.String, { status: 500 })
  .add(
    HttpApiGroup.make("Users")
      .add(
        HttpApiEndpoint.get("listUsers", "/users")
          .setUrlParams(PaginationParams)
          .addSuccess(Schema.Array(UserWithPostCount)),
      )
      .add(
        HttpApiEndpoint.get("getUser", "/users/:id")
          .setPath(IdParam)
          .addSuccess(Schema.Array(User)),
      )
      .add(
        HttpApiEndpoint.post("createUser", "/users")
          .setPayload(NewUser)
          .addSuccess(Schema.Array(User)),
      )
      .add(
        HttpApiEndpoint.del("deleteUser", "/users/:id")
          .setPath(IdParam)
          .addSuccess(Schema.Array(User)),
      ),
  )
  .add(
    HttpApiGroup.make("Posts")
      .add(
        HttpApiEndpoint.post("createPost", "/posts")
          .setPayload(NewPost)
          .addSuccess(Schema.Array(Post)),
      )
      .add(
        HttpApiEndpoint.get("recentPosts", "/posts/recent")
          .setUrlParams(PaginationParams)
          .addSuccess(Schema.Array(RecentPost)),
      )
      .add(
        HttpApiEndpoint.patch("updatePost", "/posts/:id")
          .setPath(IdParam)
          .setPayload(UpdatePostPayload)
          .addSuccess(Schema.Array(Post)),
      ),
  );

export const UsersLive = HttpApiBuilder.group(Api, "Users", (handlers) =>
  handlers
    .handle("listUsers", ({ urlParams }) =>
      withApiError(
        getUserWithPostCount(urlParams.page ?? 1, urlParams.pageSize ?? 5),
      ),
    )
    .handle("getUser", ({ path }) => withApiError(getUserById(path.id)))
    .handle("createUser", ({ payload }) => withApiError(createUsers(payload)))
    .handle("deleteUser", ({ path }) => withApiError(deleteUser(path.id))),
);

export const PostsLive = HttpApiBuilder.group(Api, "Posts", (handlers) =>
  handlers
    .handle("createPost", ({ payload }) => withApiError(createPost(payload)))
    .handle("recentPosts", ({ urlParams }) =>
      withApiError(
        getPostsForLast24Hours(urlParams.page ?? 1, urlParams.pageSize ?? 5),
      ),
    )
    .handle("updatePost", ({ path, payload }) =>
      withApiError(updatePost(path.id, payload)),
    ),
);

export const ApiLive = HttpApiBuilder.api(Api).pipe(
  Layer.provide(UsersLive),
  Layer.provide(PostsLive),
  Layer.provide(DatabaseLive),
  Layer.provide(HttpApiScalar.layer({ path: "/docs" })),
);

export const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(ApiLive),
  HttpServer.withLogAddress,
  Layer.provide(BunHttpServer.layer({ port: 3000 })),
);

if (import.meta.main) {
  const main = Layer.launch(HttpLive).pipe(
    Effect.mapError(toApiError),
    Effect.orDie,
  ) as Effect.Effect<never, never, never>;

  BunRuntime.runMain(main);
}
