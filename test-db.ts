import { Effect, Layer } from "effect";
import { DatabaseLive, PgDrizzle } from "./src/db";

const test = Effect.gen(function* () {
  const db = yield* PgDrizzle;
  console.log("got db:", typeof db);
});

test
  .pipe(Effect.provide(DatabaseLive), Effect.runPromise)
  .then(console.log)
  .catch(console.error);
