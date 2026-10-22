import assert from "node:assert/strict";
import test from "node:test";
import { CursorCatalog, modelRoutes } from "../src/runtime/catalog.js";

const models = [
  {
    id: "原生-id",
    displayName: "模型",
    variants: [
      {
        displayName: "高",
        params: [{ id: "effort", value: "high" }],
        isDefault: true,
        isMaxMode: true,
      },
    ],
  },
];
test("Cursor目录变体映射回准确原生ID和参数", async () => {
  const catalog = new CursorCatalog(async () => models);
  const routes = modelRoutes(models);
  assert.deepEqual(await catalog.select(routes[1]!.id), {
    id: "原生-id",
    params: [{ id: "effort", value: "high" }],
    maxMode: true,
  });
  assert.deepEqual(
    await catalog.select("default"),
    await catalog.select("原生-id"),
  );
  assert.ok(
    (await catalog.listModels()).some((model) => model.id === "default"),
  );
  await assert.rejects(catalog.select("伪造-id"), /模型不可用/);
});
test("Cursor目录禁止被当作通用补全接口", async () => {
  const catalog = new CursorCatalog(async () => models);
  await assert.rejects(async () => {
    for await (const _chunk of catalog.stream({
      provider: "cursor",
      model: "原生-id",
      messages: [],
    })) {
    }
  }, /不支持 Harness 通用 LLM/);
});

test("同参数不同maxMode的目录变体分别映射", async () => {
  const variants = [
    { displayName: "普通", params: [], isMaxMode: false },
    { displayName: "Max", params: [], isMaxMode: true },
  ];
  const catalog = new CursorCatalog(async () => [
    { id: "相同参数", displayName: "模型", variants },
  ]);
  const routes = await catalog.listModels();
  const normal = routes.find((model) => model.name === "普通")!;
  const max = routes.find((model) => model.name === "Max")!;
  assert.notEqual(normal.id, max.id);
  assert.equal((await catalog.select(normal.id)).maxMode, false);
  assert.equal((await catalog.select(max.id)).maxMode, true);
});
