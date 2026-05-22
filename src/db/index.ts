import * as DrizzleEffect from "drizzle-orm/effect-postgres";
import { PgClient } from "@effect/sql-pg";
import type { EffectPgDatabase } from "drizzle-orm/effect-postgres";
import { Config, Effect, Layer, ServiceMap } from "effect";

// Define a service tag for DI
export type PgDrizzle = EffectPgDatabase & { $client: PgClient.PgClient };
export const PgDrizzle = ServiceMap.Service<PgDrizzle>("PgDrizzle");

const PgLive = PgClient.layerConfig({
  url: Config.redacted("DATABASE_URL"),
});

const DrizzleLive = Layer.effect(
  PgDrizzle,
  DrizzleEffect.makeWithDefaults() as Effect.Effect<
    PgDrizzle,
    never,
    PgClient.PgClient
  >,
);

export const DatabaseLive = Layer.provideMerge(DrizzleLive, PgLive);
