import assert from "node:assert/strict";
import test from "node:test";
import { watchAccountCatalog } from "../src/host/catalog-bridge.js";
import type { AccountState } from "../src/shared/account.js";

function state(
  status: AccountState["status"],
  models: AccountState["models"] = [],
): AccountState {
  return { status, credentialSource: "saved", revision: 0, models };
}

test("相同目录重新验证时，先通知清空再通知恢复，防止宿主缓存停留在空目录", async () => {
  const models = [{ id: "model", displayName: "模型" }];
  let visible: AccountState["models"] = [];
  const rebuilt: AccountState["models"][] = [];
  const source = {
    async *watch() {
      for (const value of [
        state("connected", models),
        state("verifying"),
        state("connected", models),
      ]) {
        visible = value.status === "connected" ? value.models : [];
        yield value;
      }
    },
  };
  await watchAccountCatalog(
    source,
    () => rebuilt.push(structuredClone(visible)),
    new AbortController().signal,
  );
  assert.deepEqual(rebuilt, [[], models]);
});

test("仅按实际可见模型比较，重复及空目录中间态不会额外刷新", async () => {
  let changes = 0;
  const source = {
    async *watch() {
      for (const value of [
        state("signed-out"),
        state("waiting"),
        state("verifying"),
        state("connected"),
        state("error"),
        state("signed-out"),
      ])
        yield value;
    },
  };
  await watchAccountCatalog(
    source,
    () => changes++,
    new AbortController().signal,
  );
  assert.equal(changes, 0);
});

test("变体maxMode改变可见目录签名，重复快照不刷新", async () => {
  let changes = 0;
  const first = state("connected", [
    {
      id: "model",
      displayName: "模型",
      variants: [{ params: [], displayName: "变体", isMaxMode: false }],
    },
  ]);
  const next = structuredClone(first);
  next.models[0]!.variants![0]!.isMaxMode = true;
  const source = {
    async *watch() {
      yield first;
      yield first;
      yield next;
      yield next;
    },
  };
  await watchAccountCatalog(
    source,
    () => changes++,
    new AbortController().signal,
  );
  assert.equal(changes, 1);
});
