window.__ModuleLoader__.load({ id: "dsh-cursor-agent", factory: (require) => { var module = { exports: {} }; var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// lib/typert.remote-client.js
var import_zod = require("zod");

// node_modules/@deepseek-ai/dsh-typert-protocol/lib/types/remote-info.js
function createTypertRemoteInfo(spec, zod) {
  return new RemoteInfo(spec, zod);
}
var RemoteInfo = class {
  spec;
  zod;
  index;
  constructor(spec, zod) {
    this.spec = spec;
    this.zod = zod;
  }
  get package() {
    return this.spec.package;
  }
  get descriptors() {
    return this.resolve().descriptors;
  }
  get methods() {
    return this.resolve().methods;
  }
  resolve() {
    if (this.index !== void 0)
      return this.index;
    const zod = this.zod;
    const descriptors = [];
    const methods = /* @__PURE__ */ Object.create(null);
    for (const [endpoint, definition] of Object.entries(this.spec.methods)) {
      const separator = endpoint.indexOf("/");
      const namespace = endpoint.slice(0, separator);
      const method = endpoint.slice(separator + 1);
      const parameters = definition.parameters.map((parameter) => ({ ...parameter, wire: parameter.wire ?? parameter.name }));
      const descriptor = {
        ...definition,
        id: `${this.spec.package}#${endpoint}`,
        namespace,
        method,
        parameters,
        result: definition.result.description === void 0 ? definition.result : new ResultValue(definition.result)
      };
      if (definition.invocation.kind === "direct") {
        const inputs = [];
        const direct = Object.assign(descriptor, {
          input(options) {
            const strict = options?.strict === true;
            return inputs[strict ? 1 : 0] ??= new NamedInput(parameters, strict, zod);
          },
          invoke(remote, input, signal) {
            const named = input;
            const values = parameters.map((parameter) => named[parameter.wire]);
            if (definition.cancellation !== void 0)
              values.push(signal);
            const receiver = Reflect.get(remote, namespace);
            const call = Reflect.get(receiver, method);
            return call.apply(receiver, values);
          }
        });
        methods[endpoint] = direct;
      }
      descriptors.push(descriptor);
    }
    return this.index = { descriptors, methods };
  }
};
function optional(parameter) {
  return parameter.source === "json" && parameter.acceptsUndefined === true;
}
var NamedInput = class {
  parameters;
  strict;
  zod;
  schema;
  projection;
  constructor(parameters, strict, zod) {
    this.parameters = parameters;
    this.strict = strict;
    this.zod = zod;
  }
  codec(parameter) {
    return this.strict ? parameter.strictCodec : parameter.codec;
  }
  create = () => this.schema ??= this.zod.strictObject(Object.fromEntries(this.parameters.map((parameter) => {
    const value = this.codec(parameter).create();
    return [parameter.wire, optional(parameter) ? value.optional() : value.nonoptional()];
  })));
  get jsonSchema() {
    return this.project().jsonSchema;
  }
  get jsonSchemaError() {
    return this.project().jsonSchemaError;
  }
  project() {
    if (this.projection !== void 0)
      return this.projection;
    const unavailable = this.parameters.find((parameter) => this.codec(parameter).jsonSchema === void 0);
    if (unavailable !== void 0) {
      return this.projection = { jsonSchemaError: this.codec(unavailable).jsonSchemaError ?? `No JSON Schema for parameter ${unavailable.wire}` };
    }
    return this.projection = {
      jsonSchema: {
        type: "object",
        properties: Object.fromEntries(this.parameters.map((parameter) => [parameter.wire, {
          ...this.codec(parameter).jsonSchema,
          ...parameter.description === void 0 ? {} : { description: parameter.description }
        }])),
        required: this.parameters.filter((parameter) => !optional(parameter)).map((parameter) => parameter.wire),
        additionalProperties: false
      }
    };
  }
};
var ResultValue = class {
  spec;
  projection;
  constructor(spec) {
    this.spec = spec;
  }
  get mode() {
    return this.spec.mode;
  }
  get typeSymbol() {
    return this.spec.typeSymbol;
  }
  get create() {
    return this.spec.create;
  }
  get decode() {
    return this.spec.decode;
  }
  get encode() {
    return this.spec.encode;
  }
  get description() {
    return this.spec.description;
  }
  get jsonSchemaError() {
    return this.spec.jsonSchemaError;
  }
  get jsonSchema() {
    if (this.projection === void 0) {
      const schema = this.spec.jsonSchema;
      this.projection = { value: schema === void 0 ? void 0 : { ...schema, description: this.spec.description } };
    }
    return this.projection.value;
  }
};

// lib/typert.remote-client.js
var dsh_cursor_agent_cursorAccount_cancelLogin_parameter_0$schema$value;
var dsh_cursor_agent_cursorAccount_cancelLogin_parameter_0$schema = () => dsh_cursor_agent_cursorAccount_cancelLogin_parameter_0$schema$value ??= import_zod.z.string();
var dsh_cursor_agent_cursorAccount_cancelLogin_result$schema$value;
var dsh_cursor_agent_cursorAccount_cancelLogin_result$schema = () => dsh_cursor_agent_cursorAccount_cancelLogin_result$schema$value ??= import_zod.z.object({
  "status": import_zod.z.union([import_zod.z.literal("signed-out"), import_zod.z.literal("waiting"), import_zod.z.literal("verifying"), import_zod.z.literal("connected"), import_zod.z.literal("error")]),
  "credentialSource": import_zod.z.union([import_zod.z.literal("none"), import_zod.z.literal("saved"), import_zod.z.literal("environment")]),
  "revision": import_zod.z.number(),
  "attemptId": import_zod.z.string().optional(),
  "loginUrl": import_zod.z.string().optional(),
  "email": import_zod.z.string().optional(),
  "apiKeyExpiresAtMs": import_zod.z.number().optional(),
  "models": import_zod.z.array(import_zod.z.object({
    "id": import_zod.z.string(),
    "displayName": import_zod.z.string(),
    "parameters": import_zod.z.array(import_zod.z.object({
      "id": import_zod.z.string(),
      "displayName": import_zod.z.string().optional(),
      "values": import_zod.z.array(import_zod.z.object({
        "value": import_zod.z.string(),
        "displayName": import_zod.z.string().optional()
      }))
    })).optional()
  })),
  "error": import_zod.z.object({
    "code": import_zod.z.string(),
    "message": import_zod.z.string()
  }).optional()
});
var dsh_cursor_agent_cursorAccount_getState_result$schema$value;
var dsh_cursor_agent_cursorAccount_getState_result$schema = () => dsh_cursor_agent_cursorAccount_getState_result$schema$value ??= import_zod.z.object({
  "status": import_zod.z.union([import_zod.z.literal("signed-out"), import_zod.z.literal("waiting"), import_zod.z.literal("verifying"), import_zod.z.literal("connected"), import_zod.z.literal("error")]),
  "credentialSource": import_zod.z.union([import_zod.z.literal("none"), import_zod.z.literal("saved"), import_zod.z.literal("environment")]),
  "revision": import_zod.z.number(),
  "attemptId": import_zod.z.string().optional(),
  "loginUrl": import_zod.z.string().optional(),
  "email": import_zod.z.string().optional(),
  "apiKeyExpiresAtMs": import_zod.z.number().optional(),
  "models": import_zod.z.array(import_zod.z.object({
    "id": import_zod.z.string(),
    "displayName": import_zod.z.string(),
    "parameters": import_zod.z.array(import_zod.z.object({
      "id": import_zod.z.string(),
      "displayName": import_zod.z.string().optional(),
      "values": import_zod.z.array(import_zod.z.object({
        "value": import_zod.z.string(),
        "displayName": import_zod.z.string().optional()
      }))
    })).optional()
  })),
  "error": import_zod.z.object({
    "code": import_zod.z.string(),
    "message": import_zod.z.string()
  }).optional()
});
var dsh_cursor_agent_cursorAccount_logout_result$schema$value;
var dsh_cursor_agent_cursorAccount_logout_result$schema = () => dsh_cursor_agent_cursorAccount_logout_result$schema$value ??= import_zod.z.object({
  "status": import_zod.z.union([import_zod.z.literal("signed-out"), import_zod.z.literal("waiting"), import_zod.z.literal("verifying"), import_zod.z.literal("connected"), import_zod.z.literal("error")]),
  "credentialSource": import_zod.z.union([import_zod.z.literal("none"), import_zod.z.literal("saved"), import_zod.z.literal("environment")]),
  "revision": import_zod.z.number(),
  "attemptId": import_zod.z.string().optional(),
  "loginUrl": import_zod.z.string().optional(),
  "email": import_zod.z.string().optional(),
  "apiKeyExpiresAtMs": import_zod.z.number().optional(),
  "models": import_zod.z.array(import_zod.z.object({
    "id": import_zod.z.string(),
    "displayName": import_zod.z.string(),
    "parameters": import_zod.z.array(import_zod.z.object({
      "id": import_zod.z.string(),
      "displayName": import_zod.z.string().optional(),
      "values": import_zod.z.array(import_zod.z.object({
        "value": import_zod.z.string(),
        "displayName": import_zod.z.string().optional()
      }))
    })).optional()
  })),
  "error": import_zod.z.object({
    "code": import_zod.z.string(),
    "message": import_zod.z.string()
  }).optional()
});
var dsh_cursor_agent_cursorAccount_refresh_result$schema$value;
var dsh_cursor_agent_cursorAccount_refresh_result$schema = () => dsh_cursor_agent_cursorAccount_refresh_result$schema$value ??= import_zod.z.object({
  "status": import_zod.z.union([import_zod.z.literal("signed-out"), import_zod.z.literal("waiting"), import_zod.z.literal("verifying"), import_zod.z.literal("connected"), import_zod.z.literal("error")]),
  "credentialSource": import_zod.z.union([import_zod.z.literal("none"), import_zod.z.literal("saved"), import_zod.z.literal("environment")]),
  "revision": import_zod.z.number(),
  "attemptId": import_zod.z.string().optional(),
  "loginUrl": import_zod.z.string().optional(),
  "email": import_zod.z.string().optional(),
  "apiKeyExpiresAtMs": import_zod.z.number().optional(),
  "models": import_zod.z.array(import_zod.z.object({
    "id": import_zod.z.string(),
    "displayName": import_zod.z.string(),
    "parameters": import_zod.z.array(import_zod.z.object({
      "id": import_zod.z.string(),
      "displayName": import_zod.z.string().optional(),
      "values": import_zod.z.array(import_zod.z.object({
        "value": import_zod.z.string(),
        "displayName": import_zod.z.string().optional()
      }))
    })).optional()
  })),
  "error": import_zod.z.object({
    "code": import_zod.z.string(),
    "message": import_zod.z.string()
  }).optional()
});
var dsh_cursor_agent_cursorAccount_startLogin_result$schema$value;
var dsh_cursor_agent_cursorAccount_startLogin_result$schema = () => dsh_cursor_agent_cursorAccount_startLogin_result$schema$value ??= import_zod.z.object({
  "status": import_zod.z.union([import_zod.z.literal("signed-out"), import_zod.z.literal("waiting"), import_zod.z.literal("verifying"), import_zod.z.literal("connected"), import_zod.z.literal("error")]),
  "credentialSource": import_zod.z.union([import_zod.z.literal("none"), import_zod.z.literal("saved"), import_zod.z.literal("environment")]),
  "revision": import_zod.z.number(),
  "attemptId": import_zod.z.string().optional(),
  "loginUrl": import_zod.z.string().optional(),
  "email": import_zod.z.string().optional(),
  "apiKeyExpiresAtMs": import_zod.z.number().optional(),
  "models": import_zod.z.array(import_zod.z.object({
    "id": import_zod.z.string(),
    "displayName": import_zod.z.string(),
    "parameters": import_zod.z.array(import_zod.z.object({
      "id": import_zod.z.string(),
      "displayName": import_zod.z.string().optional(),
      "values": import_zod.z.array(import_zod.z.object({
        "value": import_zod.z.string(),
        "displayName": import_zod.z.string().optional()
      }))
    })).optional()
  })),
  "error": import_zod.z.object({
    "code": import_zod.z.string(),
    "message": import_zod.z.string()
  }).optional()
});
var dsh_cursor_agent_cursorAccount_watch_result$schema$value;
var dsh_cursor_agent_cursorAccount_watch_result$schema = () => dsh_cursor_agent_cursorAccount_watch_result$schema$value ??= import_zod.z.object({
  "status": import_zod.z.union([import_zod.z.literal("signed-out"), import_zod.z.literal("waiting"), import_zod.z.literal("verifying"), import_zod.z.literal("connected"), import_zod.z.literal("error")]),
  "credentialSource": import_zod.z.union([import_zod.z.literal("none"), import_zod.z.literal("saved"), import_zod.z.literal("environment")]),
  "revision": import_zod.z.number(),
  "attemptId": import_zod.z.string().optional(),
  "loginUrl": import_zod.z.string().optional(),
  "email": import_zod.z.string().optional(),
  "apiKeyExpiresAtMs": import_zod.z.number().optional(),
  "models": import_zod.z.array(import_zod.z.object({
    "id": import_zod.z.string(),
    "displayName": import_zod.z.string(),
    "parameters": import_zod.z.array(import_zod.z.object({
      "id": import_zod.z.string(),
      "displayName": import_zod.z.string().optional(),
      "values": import_zod.z.array(import_zod.z.object({
        "value": import_zod.z.string(),
        "displayName": import_zod.z.string().optional()
      }))
    })).optional()
  })),
  "error": import_zod.z.object({
    "code": import_zod.z.string(),
    "message": import_zod.z.string()
  }).optional()
});
var dsh_cursor_agent_cursorTasks_cancel_parameter_0$schema$value;
var dsh_cursor_agent_cursorTasks_cancel_parameter_0$schema = () => dsh_cursor_agent_cursorTasks_cancel_parameter_0$schema$value ??= import_zod.z.string();
var dsh_cursor_agent_cursorTasks_cancel_parameter_1$schema$value;
var dsh_cursor_agent_cursorTasks_cancel_parameter_1$schema = () => dsh_cursor_agent_cursorTasks_cancel_parameter_1$schema$value ??= import_zod.z.string();
var dsh_cursor_agent_cursorTasks_cancel_result$schema$value;
var dsh_cursor_agent_cursorTasks_cancel_result$schema = () => dsh_cursor_agent_cursorTasks_cancel_result$schema$value ??= import_zod.z.object({
  "messages": import_zod.z.array(import_zod.z.object({
    "id": import_zod.z.string(),
    "role": import_zod.z.union([import_zod.z.literal("user"), import_zod.z.literal("assistant"), import_zod.z.literal("thinking"), import_zod.z.literal("tool")]),
    "text": import_zod.z.string(),
    "toolName": import_zod.z.string().optional(),
    "toolStatus": import_zod.z.union([import_zod.z.literal("error"), import_zod.z.literal("running"), import_zod.z.literal("completed")]).optional()
  })),
  "id": import_zod.z.string(),
  "cwd": import_zod.z.string(),
  "revision": import_zod.z.number(),
  "model": import_zod.z.string(),
  "status": import_zod.z.union([import_zod.z.literal("idle"), import_zod.z.literal("running"), import_zod.z.literal("stored"), import_zod.z.literal("unavailable")]),
  "permissionMode": import_zod.z.union([import_zod.z.literal("readonly"), import_zod.z.literal("workspace-write"), import_zod.z.literal("shell")]),
  "sandboxEnabled": import_zod.z.boolean(),
  "attemptId": import_zod.z.string().optional()
});
var dsh_cursor_agent_cursorTasks_create_parameter_0$schema$value;
var dsh_cursor_agent_cursorTasks_create_parameter_0$schema = () => dsh_cursor_agent_cursorTasks_create_parameter_0$schema$value ??= import_zod.z.object({
  "cwd": import_zod.z.string(),
  "model": import_zod.z.string()
});
var dsh_cursor_agent_cursorTasks_create_result$schema$value;
var dsh_cursor_agent_cursorTasks_create_result$schema = () => dsh_cursor_agent_cursorTasks_create_result$schema$value ??= import_zod.z.object({
  "messages": import_zod.z.array(import_zod.z.object({
    "id": import_zod.z.string(),
    "role": import_zod.z.union([import_zod.z.literal("user"), import_zod.z.literal("assistant"), import_zod.z.literal("thinking"), import_zod.z.literal("tool")]),
    "text": import_zod.z.string(),
    "toolName": import_zod.z.string().optional(),
    "toolStatus": import_zod.z.union([import_zod.z.literal("error"), import_zod.z.literal("running"), import_zod.z.literal("completed")]).optional()
  })),
  "id": import_zod.z.string(),
  "cwd": import_zod.z.string(),
  "revision": import_zod.z.number(),
  "model": import_zod.z.string(),
  "status": import_zod.z.union([import_zod.z.literal("idle"), import_zod.z.literal("running"), import_zod.z.literal("stored"), import_zod.z.literal("unavailable")]),
  "permissionMode": import_zod.z.union([import_zod.z.literal("readonly"), import_zod.z.literal("workspace-write"), import_zod.z.literal("shell")]),
  "sandboxEnabled": import_zod.z.boolean(),
  "attemptId": import_zod.z.string().optional()
});
var dsh_cursor_agent_cursorTasks_listModels_result$schema$value;
var dsh_cursor_agent_cursorTasks_listModels_result$schema = () => dsh_cursor_agent_cursorTasks_listModels_result$schema$value ??= import_zod.z.array(import_zod.z.object({
  "id": import_zod.z.string(),
  "name": import_zod.z.string()
}));
var dsh_cursor_agent_cursorTasks_listTasks_result$schema$value;
var dsh_cursor_agent_cursorTasks_listTasks_result$schema = () => dsh_cursor_agent_cursorTasks_listTasks_result$schema$value ??= import_zod.z.array(import_zod.z.object({
  "id": import_zod.z.string(),
  "cwd": import_zod.z.string(),
  "revision": import_zod.z.number(),
  "model": import_zod.z.string(),
  "status": import_zod.z.union([import_zod.z.literal("idle"), import_zod.z.literal("running"), import_zod.z.literal("stored"), import_zod.z.literal("unavailable")]),
  "permissionMode": import_zod.z.union([import_zod.z.literal("readonly"), import_zod.z.literal("workspace-write"), import_zod.z.literal("shell")]),
  "sandboxEnabled": import_zod.z.boolean(),
  "attemptId": import_zod.z.string().optional()
}));
var dsh_cursor_agent_cursorTasks_resume_parameter_0$schema$value;
var dsh_cursor_agent_cursorTasks_resume_parameter_0$schema = () => dsh_cursor_agent_cursorTasks_resume_parameter_0$schema$value ??= import_zod.z.string();
var dsh_cursor_agent_cursorTasks_resume_result$schema$value;
var dsh_cursor_agent_cursorTasks_resume_result$schema = () => dsh_cursor_agent_cursorTasks_resume_result$schema$value ??= import_zod.z.object({
  "messages": import_zod.z.array(import_zod.z.object({
    "id": import_zod.z.string(),
    "role": import_zod.z.union([import_zod.z.literal("user"), import_zod.z.literal("assistant"), import_zod.z.literal("thinking"), import_zod.z.literal("tool")]),
    "text": import_zod.z.string(),
    "toolName": import_zod.z.string().optional(),
    "toolStatus": import_zod.z.union([import_zod.z.literal("error"), import_zod.z.literal("running"), import_zod.z.literal("completed")]).optional()
  })),
  "id": import_zod.z.string(),
  "cwd": import_zod.z.string(),
  "revision": import_zod.z.number(),
  "model": import_zod.z.string(),
  "status": import_zod.z.union([import_zod.z.literal("idle"), import_zod.z.literal("running"), import_zod.z.literal("stored"), import_zod.z.literal("unavailable")]),
  "permissionMode": import_zod.z.union([import_zod.z.literal("readonly"), import_zod.z.literal("workspace-write"), import_zod.z.literal("shell")]),
  "sandboxEnabled": import_zod.z.boolean(),
  "attemptId": import_zod.z.string().optional()
});
var dsh_cursor_agent_cursorTasks_send_parameter_0$schema$value;
var dsh_cursor_agent_cursorTasks_send_parameter_0$schema = () => dsh_cursor_agent_cursorTasks_send_parameter_0$schema$value ??= import_zod.z.string();
var dsh_cursor_agent_cursorTasks_send_parameter_1$schema$value;
var dsh_cursor_agent_cursorTasks_send_parameter_1$schema = () => dsh_cursor_agent_cursorTasks_send_parameter_1$schema$value ??= import_zod.z.string();
var dsh_cursor_agent_cursorTasks_send_result$schema$value;
var dsh_cursor_agent_cursorTasks_send_result$schema = () => dsh_cursor_agent_cursorTasks_send_result$schema$value ??= import_zod.z.object({
  "messages": import_zod.z.array(import_zod.z.object({
    "id": import_zod.z.string(),
    "role": import_zod.z.union([import_zod.z.literal("user"), import_zod.z.literal("assistant"), import_zod.z.literal("thinking"), import_zod.z.literal("tool")]),
    "text": import_zod.z.string(),
    "toolName": import_zod.z.string().optional(),
    "toolStatus": import_zod.z.union([import_zod.z.literal("error"), import_zod.z.literal("running"), import_zod.z.literal("completed")]).optional()
  })),
  "id": import_zod.z.string(),
  "cwd": import_zod.z.string(),
  "revision": import_zod.z.number(),
  "model": import_zod.z.string(),
  "status": import_zod.z.union([import_zod.z.literal("idle"), import_zod.z.literal("running"), import_zod.z.literal("stored"), import_zod.z.literal("unavailable")]),
  "permissionMode": import_zod.z.union([import_zod.z.literal("readonly"), import_zod.z.literal("workspace-write"), import_zod.z.literal("shell")]),
  "sandboxEnabled": import_zod.z.boolean(),
  "attemptId": import_zod.z.string().optional()
});
var dsh_cursor_agent_cursorTasks_snapshot_parameter_0$schema$value;
var dsh_cursor_agent_cursorTasks_snapshot_parameter_0$schema = () => dsh_cursor_agent_cursorTasks_snapshot_parameter_0$schema$value ??= import_zod.z.string();
var dsh_cursor_agent_cursorTasks_snapshot_result$schema$value;
var dsh_cursor_agent_cursorTasks_snapshot_result$schema = () => dsh_cursor_agent_cursorTasks_snapshot_result$schema$value ??= import_zod.z.object({
  "messages": import_zod.z.array(import_zod.z.object({
    "id": import_zod.z.string(),
    "role": import_zod.z.union([import_zod.z.literal("user"), import_zod.z.literal("assistant"), import_zod.z.literal("thinking"), import_zod.z.literal("tool")]),
    "text": import_zod.z.string(),
    "toolName": import_zod.z.string().optional(),
    "toolStatus": import_zod.z.union([import_zod.z.literal("error"), import_zod.z.literal("running"), import_zod.z.literal("completed")]).optional()
  })),
  "id": import_zod.z.string(),
  "cwd": import_zod.z.string(),
  "revision": import_zod.z.number(),
  "model": import_zod.z.string(),
  "status": import_zod.z.union([import_zod.z.literal("idle"), import_zod.z.literal("running"), import_zod.z.literal("stored"), import_zod.z.literal("unavailable")]),
  "permissionMode": import_zod.z.union([import_zod.z.literal("readonly"), import_zod.z.literal("workspace-write"), import_zod.z.literal("shell")]),
  "sandboxEnabled": import_zod.z.boolean(),
  "attemptId": import_zod.z.string().optional()
});
var dsh_cursor_agent_cursorTasks_watch_parameter_0$schema$value;
var dsh_cursor_agent_cursorTasks_watch_parameter_0$schema = () => dsh_cursor_agent_cursorTasks_watch_parameter_0$schema$value ??= import_zod.z.string();
var dsh_cursor_agent_cursorTasks_watch_result$schema$value;
var dsh_cursor_agent_cursorTasks_watch_result$schema = () => dsh_cursor_agent_cursorTasks_watch_result$schema$value ??= import_zod.z.object({
  "messages": import_zod.z.array(import_zod.z.object({
    "id": import_zod.z.string(),
    "role": import_zod.z.union([import_zod.z.literal("user"), import_zod.z.literal("assistant"), import_zod.z.literal("thinking"), import_zod.z.literal("tool")]),
    "text": import_zod.z.string(),
    "toolName": import_zod.z.string().optional(),
    "toolStatus": import_zod.z.union([import_zod.z.literal("error"), import_zod.z.literal("running"), import_zod.z.literal("completed")]).optional()
  })),
  "id": import_zod.z.string(),
  "cwd": import_zod.z.string(),
  "revision": import_zod.z.number(),
  "model": import_zod.z.string(),
  "status": import_zod.z.union([import_zod.z.literal("idle"), import_zod.z.literal("running"), import_zod.z.literal("stored"), import_zod.z.literal("unavailable")]),
  "permissionMode": import_zod.z.union([import_zod.z.literal("readonly"), import_zod.z.literal("workspace-write"), import_zod.z.literal("shell")]),
  "sandboxEnabled": import_zod.z.boolean(),
  "attemptId": import_zod.z.string().optional()
});
var dsh_cursor_agent_cursorAccount_cancelLogin_parameter_0_strict$schema$value;
var dsh_cursor_agent_cursorAccount_cancelLogin_parameter_0_strict$schema = () => dsh_cursor_agent_cursorAccount_cancelLogin_parameter_0_strict$schema$value ??= import_zod.z.string();
var dsh_cursor_agent_cursorTasks_cancel_parameter_0_strict$schema$value;
var dsh_cursor_agent_cursorTasks_cancel_parameter_0_strict$schema = () => dsh_cursor_agent_cursorTasks_cancel_parameter_0_strict$schema$value ??= import_zod.z.string();
var dsh_cursor_agent_cursorTasks_cancel_parameter_1_strict$schema$value;
var dsh_cursor_agent_cursorTasks_cancel_parameter_1_strict$schema = () => dsh_cursor_agent_cursorTasks_cancel_parameter_1_strict$schema$value ??= import_zod.z.string();
var dsh_cursor_agent_cursorTasks_create_parameter_0_strict$schema$value;
var dsh_cursor_agent_cursorTasks_create_parameter_0_strict$schema = () => dsh_cursor_agent_cursorTasks_create_parameter_0_strict$schema$value ??= import_zod.z.strictObject({
  "cwd": import_zod.z.string(),
  "model": import_zod.z.string()
});
var dsh_cursor_agent_cursorTasks_resume_parameter_0_strict$schema$value;
var dsh_cursor_agent_cursorTasks_resume_parameter_0_strict$schema = () => dsh_cursor_agent_cursorTasks_resume_parameter_0_strict$schema$value ??= import_zod.z.string();
var dsh_cursor_agent_cursorTasks_send_parameter_0_strict$schema$value;
var dsh_cursor_agent_cursorTasks_send_parameter_0_strict$schema = () => dsh_cursor_agent_cursorTasks_send_parameter_0_strict$schema$value ??= import_zod.z.string();
var dsh_cursor_agent_cursorTasks_send_parameter_1_strict$schema$value;
var dsh_cursor_agent_cursorTasks_send_parameter_1_strict$schema = () => dsh_cursor_agent_cursorTasks_send_parameter_1_strict$schema$value ??= import_zod.z.string();
var dsh_cursor_agent_cursorTasks_snapshot_parameter_0_strict$schema$value;
var dsh_cursor_agent_cursorTasks_snapshot_parameter_0_strict$schema = () => dsh_cursor_agent_cursorTasks_snapshot_parameter_0_strict$schema$value ??= import_zod.z.string();
var dsh_cursor_agent_cursorTasks_watch_parameter_0_strict$schema$value;
var dsh_cursor_agent_cursorTasks_watch_parameter_0_strict$schema = () => dsh_cursor_agent_cursorTasks_watch_parameter_0_strict$schema$value ??= import_zod.z.string();
var TYPERT_REMOTE = createTypertRemoteInfo({
  package: "dsh-cursor-agent",
  methods: {
    "cursorAccount/cancelLogin": {
      service: "cursorAccount",
      invocation: { kind: "direct" },
      parameters: [
        {
          name: "attemptId",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "dsh-cursor-agent#cursorAccount/cancelLogin:attemptId",
            create: dsh_cursor_agent_cursorAccount_cancelLogin_parameter_0$schema,
            jsonSchema: { "type": "string" }
          },
          strictCodec: {
            mode: "strict",
            typeSymbol: "dsh-cursor-agent#cursorAccount/cancelLogin:attemptId",
            create: dsh_cursor_agent_cursorAccount_cancelLogin_parameter_0_strict$schema,
            jsonSchema: { "type": "string" }
          }
        }
      ],
      result: {
        mode: "strict",
        typeSymbol: "dsh-cursor-agent/shared/account#AccountState",
        create: dsh_cursor_agent_cursorAccount_cancelLogin_result$schema,
        jsonSchema: { "type": "object", "properties": { "status": { "type": "string", "enum": ["signed-out", "waiting", "verifying", "connected", "error"] }, "credentialSource": { "type": "string", "enum": ["none", "saved", "environment"] }, "revision": { "type": "number" }, "attemptId": { "type": "string" }, "loginUrl": { "type": "string" }, "email": { "type": "string" }, "apiKeyExpiresAtMs": { "type": "number" }, "models": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "displayName": { "type": "string" }, "parameters": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "displayName": { "type": "string" }, "values": { "type": "array", "items": { "type": "object", "properties": { "value": { "type": "string" }, "displayName": { "type": "string" } }, "required": ["value"], "additionalProperties": true } } }, "required": ["id", "values"], "additionalProperties": true } } }, "required": ["id", "displayName"], "additionalProperties": true } }, "error": { "type": "object", "properties": { "code": { "type": "string" }, "message": { "type": "string" } }, "required": ["code", "message"], "additionalProperties": true } }, "required": ["status", "credentialSource", "revision", "models"], "additionalProperties": true }
      },
      sourceLocation: { "file": "packages/cursor-agent/src/host/remote-service.ts", "line": 37, "column": 3 }
    },
    "cursorAccount/getState": {
      service: "cursorAccount",
      invocation: { kind: "direct" },
      parameters: [],
      result: {
        mode: "strict",
        typeSymbol: "dsh-cursor-agent/shared/account#AccountState",
        create: dsh_cursor_agent_cursorAccount_getState_result$schema,
        jsonSchema: { "type": "object", "properties": { "status": { "type": "string", "enum": ["signed-out", "waiting", "verifying", "connected", "error"] }, "credentialSource": { "type": "string", "enum": ["none", "saved", "environment"] }, "revision": { "type": "number" }, "attemptId": { "type": "string" }, "loginUrl": { "type": "string" }, "email": { "type": "string" }, "apiKeyExpiresAtMs": { "type": "number" }, "models": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "displayName": { "type": "string" }, "parameters": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "displayName": { "type": "string" }, "values": { "type": "array", "items": { "type": "object", "properties": { "value": { "type": "string" }, "displayName": { "type": "string" } }, "required": ["value"], "additionalProperties": true } } }, "required": ["id", "values"], "additionalProperties": true } } }, "required": ["id", "displayName"], "additionalProperties": true } }, "error": { "type": "object", "properties": { "code": { "type": "string" }, "message": { "type": "string" } }, "required": ["code", "message"], "additionalProperties": true } }, "required": ["status", "credentialSource", "revision", "models"], "additionalProperties": true }
      },
      sourceLocation: { "file": "packages/cursor-agent/src/host/remote-service.ts", "line": 27, "column": 3 }
    },
    "cursorAccount/logout": {
      service: "cursorAccount",
      invocation: { kind: "direct" },
      parameters: [],
      result: {
        mode: "strict",
        typeSymbol: "dsh-cursor-agent/shared/account#AccountState",
        create: dsh_cursor_agent_cursorAccount_logout_result$schema,
        jsonSchema: { "type": "object", "properties": { "status": { "type": "string", "enum": ["signed-out", "waiting", "verifying", "connected", "error"] }, "credentialSource": { "type": "string", "enum": ["none", "saved", "environment"] }, "revision": { "type": "number" }, "attemptId": { "type": "string" }, "loginUrl": { "type": "string" }, "email": { "type": "string" }, "apiKeyExpiresAtMs": { "type": "number" }, "models": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "displayName": { "type": "string" }, "parameters": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "displayName": { "type": "string" }, "values": { "type": "array", "items": { "type": "object", "properties": { "value": { "type": "string" }, "displayName": { "type": "string" } }, "required": ["value"], "additionalProperties": true } } }, "required": ["id", "values"], "additionalProperties": true } } }, "required": ["id", "displayName"], "additionalProperties": true } }, "error": { "type": "object", "properties": { "code": { "type": "string" }, "message": { "type": "string" } }, "required": ["code", "message"], "additionalProperties": true } }, "required": ["status", "credentialSource", "revision", "models"], "additionalProperties": true }
      },
      sourceLocation: { "file": "packages/cursor-agent/src/host/remote-service.ts", "line": 47, "column": 3 }
    },
    "cursorAccount/refresh": {
      service: "cursorAccount",
      invocation: { kind: "direct" },
      parameters: [],
      result: {
        mode: "strict",
        typeSymbol: "dsh-cursor-agent/shared/account#AccountState",
        create: dsh_cursor_agent_cursorAccount_refresh_result$schema,
        jsonSchema: { "type": "object", "properties": { "status": { "type": "string", "enum": ["signed-out", "waiting", "verifying", "connected", "error"] }, "credentialSource": { "type": "string", "enum": ["none", "saved", "environment"] }, "revision": { "type": "number" }, "attemptId": { "type": "string" }, "loginUrl": { "type": "string" }, "email": { "type": "string" }, "apiKeyExpiresAtMs": { "type": "number" }, "models": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "displayName": { "type": "string" }, "parameters": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "displayName": { "type": "string" }, "values": { "type": "array", "items": { "type": "object", "properties": { "value": { "type": "string" }, "displayName": { "type": "string" } }, "required": ["value"], "additionalProperties": true } } }, "required": ["id", "values"], "additionalProperties": true } } }, "required": ["id", "displayName"], "additionalProperties": true } }, "error": { "type": "object", "properties": { "code": { "type": "string" }, "message": { "type": "string" } }, "required": ["code", "message"], "additionalProperties": true } }, "required": ["status", "credentialSource", "revision", "models"], "additionalProperties": true }
      },
      sourceLocation: { "file": "packages/cursor-agent/src/host/remote-service.ts", "line": 42, "column": 3 }
    },
    "cursorAccount/startLogin": {
      service: "cursorAccount",
      invocation: { kind: "direct" },
      parameters: [],
      result: {
        mode: "strict",
        typeSymbol: "dsh-cursor-agent/shared/account#AccountState",
        create: dsh_cursor_agent_cursorAccount_startLogin_result$schema,
        jsonSchema: { "type": "object", "properties": { "status": { "type": "string", "enum": ["signed-out", "waiting", "verifying", "connected", "error"] }, "credentialSource": { "type": "string", "enum": ["none", "saved", "environment"] }, "revision": { "type": "number" }, "attemptId": { "type": "string" }, "loginUrl": { "type": "string" }, "email": { "type": "string" }, "apiKeyExpiresAtMs": { "type": "number" }, "models": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "displayName": { "type": "string" }, "parameters": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "displayName": { "type": "string" }, "values": { "type": "array", "items": { "type": "object", "properties": { "value": { "type": "string" }, "displayName": { "type": "string" } }, "required": ["value"], "additionalProperties": true } } }, "required": ["id", "values"], "additionalProperties": true } } }, "required": ["id", "displayName"], "additionalProperties": true } }, "error": { "type": "object", "properties": { "code": { "type": "string" }, "message": { "type": "string" } }, "required": ["code", "message"], "additionalProperties": true } }, "required": ["status", "credentialSource", "revision", "models"], "additionalProperties": true }
      },
      sourceLocation: { "file": "packages/cursor-agent/src/host/remote-service.ts", "line": 32, "column": 3 }
    },
    "cursorAccount/watch": {
      service: "cursorAccount",
      mode: "stream",
      invocation: { kind: "direct" },
      parameters: [],
      cancellation: { parameter: "signal" },
      result: {
        mode: "strict",
        typeSymbol: "dsh-cursor-agent/shared/account#AccountState",
        create: dsh_cursor_agent_cursorAccount_watch_result$schema,
        jsonSchema: { "type": "object", "properties": { "status": { "type": "string", "enum": ["signed-out", "waiting", "verifying", "connected", "error"] }, "credentialSource": { "type": "string", "enum": ["none", "saved", "environment"] }, "revision": { "type": "number" }, "attemptId": { "type": "string" }, "loginUrl": { "type": "string" }, "email": { "type": "string" }, "apiKeyExpiresAtMs": { "type": "number" }, "models": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "displayName": { "type": "string" }, "parameters": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "displayName": { "type": "string" }, "values": { "type": "array", "items": { "type": "object", "properties": { "value": { "type": "string" }, "displayName": { "type": "string" } }, "required": ["value"], "additionalProperties": true } } }, "required": ["id", "values"], "additionalProperties": true } } }, "required": ["id", "displayName"], "additionalProperties": true } }, "error": { "type": "object", "properties": { "code": { "type": "string" }, "message": { "type": "string" } }, "required": ["code", "message"], "additionalProperties": true } }, "required": ["status", "credentialSource", "revision", "models"], "additionalProperties": true }
      },
      sourceLocation: { "file": "packages/cursor-agent/src/host/remote-service.ts", "line": 52, "column": 3 }
    },
    "cursorTasks/cancel": {
      service: "cursorTasks",
      invocation: { kind: "direct" },
      parameters: [
        {
          name: "id",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "dsh-cursor-agent#cursorTasks/cancel:id",
            create: dsh_cursor_agent_cursorTasks_cancel_parameter_0$schema,
            jsonSchema: { "type": "string" }
          },
          strictCodec: {
            mode: "strict",
            typeSymbol: "dsh-cursor-agent#cursorTasks/cancel:id",
            create: dsh_cursor_agent_cursorTasks_cancel_parameter_0_strict$schema,
            jsonSchema: { "type": "string" }
          }
        },
        {
          name: "attemptId",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "dsh-cursor-agent#cursorTasks/cancel:attemptId",
            create: dsh_cursor_agent_cursorTasks_cancel_parameter_1$schema,
            jsonSchema: { "type": "string" }
          },
          strictCodec: {
            mode: "strict",
            typeSymbol: "dsh-cursor-agent#cursorTasks/cancel:attemptId",
            create: dsh_cursor_agent_cursorTasks_cancel_parameter_1_strict$schema,
            jsonSchema: { "type": "string" }
          }
        }
      ],
      result: {
        mode: "strict",
        typeSymbol: "dsh-cursor-agent/shared/tasks#TaskState",
        create: dsh_cursor_agent_cursorTasks_cancel_result$schema,
        jsonSchema: { "type": "object", "properties": { "messages": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "role": { "type": "string", "enum": ["user", "assistant", "thinking", "tool"] }, "text": { "type": "string" }, "toolName": { "type": "string" }, "toolStatus": { "type": "string", "enum": ["error", "running", "completed"] } }, "required": ["id", "role", "text"], "additionalProperties": true } }, "id": { "type": "string" }, "cwd": { "type": "string" }, "revision": { "type": "number" }, "model": { "type": "string" }, "status": { "type": "string", "enum": ["idle", "running", "stored", "unavailable"] }, "permissionMode": { "type": "string", "enum": ["readonly", "workspace-write", "shell"] }, "sandboxEnabled": { "type": "boolean" }, "attemptId": { "type": "string" } }, "required": ["messages", "id", "cwd", "revision", "model", "status", "permissionMode", "sandboxEnabled"], "additionalProperties": true }
      },
      sourceLocation: { "file": "packages/cursor-agent/src/host/task-service.ts", "line": 158, "column": 3 }
    },
    "cursorTasks/create": {
      service: "cursorTasks",
      invocation: { kind: "direct" },
      parameters: [
        {
          name: "input",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "dsh-cursor-agent/shared/tasks#CreateTaskInput",
            create: dsh_cursor_agent_cursorTasks_create_parameter_0$schema,
            jsonSchema: { "type": "object", "properties": { "cwd": { "type": "string" }, "model": { "type": "string" } }, "required": ["cwd", "model"], "additionalProperties": true }
          },
          strictCodec: {
            mode: "strict",
            typeSymbol: "dsh-cursor-agent/shared/tasks#CreateTaskInput",
            create: dsh_cursor_agent_cursorTasks_create_parameter_0_strict$schema,
            jsonSchema: { "type": "object", "properties": { "cwd": { "type": "string" }, "model": { "type": "string" } }, "required": ["cwd", "model"], "additionalProperties": false }
          }
        }
      ],
      result: {
        mode: "strict",
        typeSymbol: "dsh-cursor-agent/shared/tasks#TaskState",
        create: dsh_cursor_agent_cursorTasks_create_result$schema,
        jsonSchema: { "type": "object", "properties": { "messages": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "role": { "type": "string", "enum": ["user", "assistant", "thinking", "tool"] }, "text": { "type": "string" }, "toolName": { "type": "string" }, "toolStatus": { "type": "string", "enum": ["error", "running", "completed"] } }, "required": ["id", "role", "text"], "additionalProperties": true } }, "id": { "type": "string" }, "cwd": { "type": "string" }, "revision": { "type": "number" }, "model": { "type": "string" }, "status": { "type": "string", "enum": ["idle", "running", "stored", "unavailable"] }, "permissionMode": { "type": "string", "enum": ["readonly", "workspace-write", "shell"] }, "sandboxEnabled": { "type": "boolean" }, "attemptId": { "type": "string" } }, "required": ["messages", "id", "cwd", "revision", "model", "status", "permissionMode", "sandboxEnabled"], "additionalProperties": true }
      },
      sourceLocation: { "file": "packages/cursor-agent/src/host/task-service.ts", "line": 112, "column": 3 }
    },
    "cursorTasks/listModels": {
      service: "cursorTasks",
      invocation: { kind: "direct" },
      parameters: [],
      result: {
        mode: "strict",
        typeSymbol: "dsh-cursor-agent#cursorTasks/listModels:result",
        create: dsh_cursor_agent_cursorTasks_listModels_result$schema,
        jsonSchema: { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "name": { "type": "string" } }, "required": ["id", "name"], "additionalProperties": true } }
      },
      sourceLocation: { "file": "packages/cursor-agent/src/host/task-service.ts", "line": 99, "column": 3 }
    },
    "cursorTasks/listTasks": {
      service: "cursorTasks",
      invocation: { kind: "direct" },
      parameters: [],
      result: {
        mode: "strict",
        typeSymbol: "dsh-cursor-agent#cursorTasks/listTasks:result",
        create: dsh_cursor_agent_cursorTasks_listTasks_result$schema,
        jsonSchema: { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "cwd": { "type": "string" }, "revision": { "type": "number" }, "model": { "type": "string" }, "status": { "type": "string", "enum": ["idle", "running", "stored", "unavailable"] }, "permissionMode": { "type": "string", "enum": ["readonly", "workspace-write", "shell"] }, "sandboxEnabled": { "type": "boolean" }, "attemptId": { "type": "string" } }, "required": ["id", "cwd", "revision", "model", "status", "permissionMode", "sandboxEnabled"], "additionalProperties": true } }
      },
      sourceLocation: { "file": "packages/cursor-agent/src/host/task-service.ts", "line": 108, "column": 3 }
    },
    "cursorTasks/resume": {
      service: "cursorTasks",
      invocation: { kind: "direct" },
      parameters: [
        {
          name: "id",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "dsh-cursor-agent#cursorTasks/resume:id",
            create: dsh_cursor_agent_cursorTasks_resume_parameter_0$schema,
            jsonSchema: { "type": "string" }
          },
          strictCodec: {
            mode: "strict",
            typeSymbol: "dsh-cursor-agent#cursorTasks/resume:id",
            create: dsh_cursor_agent_cursorTasks_resume_parameter_0_strict$schema,
            jsonSchema: { "type": "string" }
          }
        }
      ],
      result: {
        mode: "strict",
        typeSymbol: "dsh-cursor-agent/shared/tasks#TaskState",
        create: dsh_cursor_agent_cursorTasks_resume_result$schema,
        jsonSchema: { "type": "object", "properties": { "messages": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "role": { "type": "string", "enum": ["user", "assistant", "thinking", "tool"] }, "text": { "type": "string" }, "toolName": { "type": "string" }, "toolStatus": { "type": "string", "enum": ["error", "running", "completed"] } }, "required": ["id", "role", "text"], "additionalProperties": true } }, "id": { "type": "string" }, "cwd": { "type": "string" }, "revision": { "type": "number" }, "model": { "type": "string" }, "status": { "type": "string", "enum": ["idle", "running", "stored", "unavailable"] }, "permissionMode": { "type": "string", "enum": ["readonly", "workspace-write", "shell"] }, "sandboxEnabled": { "type": "boolean" }, "attemptId": { "type": "string" } }, "required": ["messages", "id", "cwd", "revision", "model", "status", "permissionMode", "sandboxEnabled"], "additionalProperties": true }
      },
      sourceLocation: { "file": "packages/cursor-agent/src/host/task-service.ts", "line": 131, "column": 3 }
    },
    "cursorTasks/send": {
      service: "cursorTasks",
      invocation: { kind: "direct" },
      parameters: [
        {
          name: "id",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "dsh-cursor-agent#cursorTasks/send:id",
            create: dsh_cursor_agent_cursorTasks_send_parameter_0$schema,
            jsonSchema: { "type": "string" }
          },
          strictCodec: {
            mode: "strict",
            typeSymbol: "dsh-cursor-agent#cursorTasks/send:id",
            create: dsh_cursor_agent_cursorTasks_send_parameter_0_strict$schema,
            jsonSchema: { "type": "string" }
          }
        },
        {
          name: "text",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "dsh-cursor-agent#cursorTasks/send:text",
            create: dsh_cursor_agent_cursorTasks_send_parameter_1$schema,
            jsonSchema: { "type": "string" }
          },
          strictCodec: {
            mode: "strict",
            typeSymbol: "dsh-cursor-agent#cursorTasks/send:text",
            create: dsh_cursor_agent_cursorTasks_send_parameter_1_strict$schema,
            jsonSchema: { "type": "string" }
          }
        }
      ],
      result: {
        mode: "strict",
        typeSymbol: "dsh-cursor-agent/shared/tasks#TaskState",
        create: dsh_cursor_agent_cursorTasks_send_result$schema,
        jsonSchema: { "type": "object", "properties": { "messages": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "role": { "type": "string", "enum": ["user", "assistant", "thinking", "tool"] }, "text": { "type": "string" }, "toolName": { "type": "string" }, "toolStatus": { "type": "string", "enum": ["error", "running", "completed"] } }, "required": ["id", "role", "text"], "additionalProperties": true } }, "id": { "type": "string" }, "cwd": { "type": "string" }, "revision": { "type": "number" }, "model": { "type": "string" }, "status": { "type": "string", "enum": ["idle", "running", "stored", "unavailable"] }, "permissionMode": { "type": "string", "enum": ["readonly", "workspace-write", "shell"] }, "sandboxEnabled": { "type": "boolean" }, "attemptId": { "type": "string" } }, "required": ["messages", "id", "cwd", "revision", "model", "status", "permissionMode", "sandboxEnabled"], "additionalProperties": true }
      },
      sourceLocation: { "file": "packages/cursor-agent/src/host/task-service.ts", "line": 138, "column": 3 }
    },
    "cursorTasks/snapshot": {
      service: "cursorTasks",
      invocation: { kind: "direct" },
      parameters: [
        {
          name: "id",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "dsh-cursor-agent#cursorTasks/snapshot:id",
            create: dsh_cursor_agent_cursorTasks_snapshot_parameter_0$schema,
            jsonSchema: { "type": "string" }
          },
          strictCodec: {
            mode: "strict",
            typeSymbol: "dsh-cursor-agent#cursorTasks/snapshot:id",
            create: dsh_cursor_agent_cursorTasks_snapshot_parameter_0_strict$schema,
            jsonSchema: { "type": "string" }
          }
        }
      ],
      result: {
        mode: "strict",
        typeSymbol: "dsh-cursor-agent/shared/tasks#TaskState",
        create: dsh_cursor_agent_cursorTasks_snapshot_result$schema,
        jsonSchema: { "type": "object", "properties": { "messages": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "role": { "type": "string", "enum": ["user", "assistant", "thinking", "tool"] }, "text": { "type": "string" }, "toolName": { "type": "string" }, "toolStatus": { "type": "string", "enum": ["error", "running", "completed"] } }, "required": ["id", "role", "text"], "additionalProperties": true } }, "id": { "type": "string" }, "cwd": { "type": "string" }, "revision": { "type": "number" }, "model": { "type": "string" }, "status": { "type": "string", "enum": ["idle", "running", "stored", "unavailable"] }, "permissionMode": { "type": "string", "enum": ["readonly", "workspace-write", "shell"] }, "sandboxEnabled": { "type": "boolean" }, "attemptId": { "type": "string" } }, "required": ["messages", "id", "cwd", "revision", "model", "status", "permissionMode", "sandboxEnabled"], "additionalProperties": true }
      },
      sourceLocation: { "file": "packages/cursor-agent/src/host/task-service.ts", "line": 167, "column": 3 }
    },
    "cursorTasks/watch": {
      service: "cursorTasks",
      mode: "stream",
      invocation: { kind: "direct" },
      parameters: [
        {
          name: "id",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "dsh-cursor-agent#cursorTasks/watch:id",
            create: dsh_cursor_agent_cursorTasks_watch_parameter_0$schema,
            jsonSchema: { "type": "string" }
          },
          strictCodec: {
            mode: "strict",
            typeSymbol: "dsh-cursor-agent#cursorTasks/watch:id",
            create: dsh_cursor_agent_cursorTasks_watch_parameter_0_strict$schema,
            jsonSchema: { "type": "string" }
          }
        }
      ],
      cancellation: { parameter: "signal" },
      result: {
        mode: "strict",
        typeSymbol: "dsh-cursor-agent/shared/tasks#TaskState",
        create: dsh_cursor_agent_cursorTasks_watch_result$schema,
        jsonSchema: { "type": "object", "properties": { "messages": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "role": { "type": "string", "enum": ["user", "assistant", "thinking", "tool"] }, "text": { "type": "string" }, "toolName": { "type": "string" }, "toolStatus": { "type": "string", "enum": ["error", "running", "completed"] } }, "required": ["id", "role", "text"], "additionalProperties": true } }, "id": { "type": "string" }, "cwd": { "type": "string" }, "revision": { "type": "number" }, "model": { "type": "string" }, "status": { "type": "string", "enum": ["idle", "running", "stored", "unavailable"] }, "permissionMode": { "type": "string", "enum": ["readonly", "workspace-write", "shell"] }, "sandboxEnabled": { "type": "boolean" }, "attemptId": { "type": "string" } }, "required": ["messages", "id", "cwd", "revision", "model", "status", "permissionMode", "sandboxEnabled"], "additionalProperties": true }
      },
      sourceLocation: { "file": "packages/cursor-agent/src/host/task-service.ts", "line": 174, "column": 10 }
    }
  }
}, import_zod.z);
var typert_remote_client_default = TYPERT_REMOTE;

// src/client/CursorAccountCard.tsx
var import_react = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/browser.ts
function safeLoginUrl(value) {
  if (!value) return void 0;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port && (url.hostname === "cursor.com" || url.hostname.endsWith(".cursor.com")) ? url.href : void 0;
  } catch {
    return void 0;
  }
}
async function copyLoginUrl(url, clipboard = globalThis.navigator?.clipboard) {
  try {
    if (!clipboard) throw new Error("clipboard unavailable");
    await clipboard.writeText(url);
    return "\u94FE\u63A5\u5DF2\u590D\u5236";
  } catch {
    return "\u590D\u5236\u5931\u8D25\uFF0C\u8BF7\u4F7F\u7528\u201C\u6253\u5F00\u6D4F\u89C8\u5668\u201D\u3002";
  }
}

// src/client/CursorAccountCard.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var card = {
  maxWidth: 720,
  padding: "16px",
  borderRadius: "var(--dsw-radius-xl, 12px)",
  border: "0.5px solid var(--dsw-alias-settings-card-stroke)",
  background: "var(--dsw-alias-settings-card-fill)",
  color: "var(--dsw-alias-label-primary)",
  display: "flex",
  flexDirection: "column",
  gap: 12
};
var secondary = {
  margin: 0,
  fontSize: 13,
  lineHeight: "20px",
  color: "var(--dsw-alias-label-tertiary)"
};
function CursorAccountCard({
  controller
}) {
  const snapshot = (0, import_react.useSyncExternalStore)(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot
  );
  const [copyStatus, setCopyStatus] = (0, import_react.useState)("");
  (0, import_react.useEffect)(() => {
    const unmount = controller.mount();
    void controller.refresh();
    return unmount;
  }, [controller]);
  const state = snapshot.state;
  const waiting = state?.status === "waiting" || state?.status === "verifying";
  const url = safeLoginUrl(state?.loginUrl);
  const error = snapshot.error ?? state?.error?.message;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { style: card, "aria-label": "Cursor \u8D26\u53F7", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { style: { margin: 0, fontSize: 15, fontWeight: 500 }, children: "Cursor \u8D26\u53F7" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: secondary, children: !state ? "\u6B63\u5728\u8BFB\u53D6\u72B6\u6001\u2026" : state.status === "connected" ? "\u8FDE\u63A5\u6210\u529F" : state.status === "waiting" ? "\u7B49\u5F85\u6D4F\u89C8\u5668\u6388\u6743" : state.status === "verifying" ? "\u6B63\u5728\u9A8C\u8BC1\u8FDE\u63A5\u2026" : state.status === "error" ? "\u8FDE\u63A5\u5931\u8D25" : "\u672A\u767B\u5F55" })
        ]
      }
    ),
    state?.email && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { margin: 0, overflowWrap: "anywhere" }, children: state.email }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: secondary, children: "\u4F7F\u7528 Cursor \u8D26\u53F7\u767B\u5F55\uFF0C\u67E5\u770B\u53EF\u7528\u6A21\u578B\u3002" }),
    state?.credentialSource === "environment" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: secondary, children: "\u5F53\u524D\u4F7F\u7528 CURSOR_API_KEY \u73AF\u5883\u53D8\u91CF\uFF0C\u5176\u4F18\u5148\u4E8E\u4FDD\u5B58\u7684\u767B\u5F55\u3002\u9000\u51FA\u4EC5\u6E05\u9664\u4FDD\u5B58\u7684\u767B\u5F55\uFF0C\u73AF\u5883\u53D8\u91CF\u4ECD\u7136\u6709\u6548\u3002" }),
    state?.credentialSource === "saved" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: secondary, children: "\u9000\u51FA\u4F1A\u6E05\u9664\u6B64\u8BBE\u5907\u4FDD\u5B58\u7684\u767B\u5F55\u3002" }),
    state?.status === "waiting" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: secondary, children: "\u8BF7\u5728\u6D4F\u89C8\u5668\u5B8C\u6210\u6388\u6743\u3002\u5173\u95ED\u6B64\u9875\u9762\u4F1A\u505C\u6B62\u72B6\u6001\u89C2\u5BDF\uFF0C\u767B\u5F55\u4ECD\u53EF\u7EE7\u7EED\u3002" }),
    state?.status === "verifying" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: secondary, children: "\u6B63\u5728\u6838\u5BF9\u8D26\u53F7\u4E0E\u6A21\u578B\u76EE\u5F55\uFF0C\u8BF7\u7A0D\u5019\u3002" }),
    error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "p",
      {
        role: "alert",
        style: { ...secondary, color: "var(--dsw-alias-state-warn-label)" },
        children: error
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8
        },
        children: [
          !waiting && state?.status !== "connected" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            import_dsh_client_ui_primitives.Button,
            {
              disabled: snapshot.busy || !state,
              onClick: () => void controller.login(),
              children: "\u767B\u5F55 Cursor"
            }
          ),
          waiting && url && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", { href: url, target: "_blank", rel: "noopener noreferrer", children: "\u6253\u5F00\u6D4F\u89C8\u5668" }),
          waiting && url && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            import_dsh_client_ui_primitives.Button,
            {
              disabled: snapshot.busy,
              onClick: () => {
                void copyLoginUrl(url).then(setCopyStatus);
              },
              children: "\u590D\u5236\u94FE\u63A5"
            }
          ),
          waiting && state.attemptId && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            import_dsh_client_ui_primitives.Button,
            {
              disabled: snapshot.busy,
              onClick: () => void controller.cancel(state.attemptId),
              children: "\u53D6\u6D88\u767B\u5F55"
            }
          ),
          !waiting && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            import_dsh_client_ui_primitives.Button,
            {
              disabled: snapshot.busy,
              onClick: () => void controller.refresh(),
              children: snapshot.busy ? "\u5904\u7406\u4E2D\u2026" : "\u5237\u65B0\u72B6\u6001"
            }
          ),
          state && !waiting && state.credentialSource !== "none" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            import_dsh_client_ui_primitives.Button,
            {
              disabled: snapshot.busy,
              onClick: () => void controller.logout(),
              children: "\u9000\u51FA\u767B\u5F55"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { role: "status", style: secondary, children: copyStatus })
        ]
      }
    ),
    state?.status === "connected" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { style: secondary, children: [
        "\u767B\u5F55\u9A8C\u8BC1\u901A\u8FC7\uFF0C\u5DF2\u8BFB\u53D6 ",
        state.models.length,
        " \u4E2A Cursor \u6A21\u578B\u3002"
      ] }),
      state.models.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", { children: "\u67E5\u770B\u6A21\u578B\u76EE\u5F55" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "ul",
          {
            style: {
              margin: "8px 0 0",
              paddingLeft: 20,
              maxHeight: 240,
              overflow: "auto"
            },
            children: state.models.map((model) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { style: { overflowWrap: "anywhere" }, children: [
              model.displayName,
              " ",
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: secondary, children: [
                "\uFF08",
                model.id,
                "\uFF09"
              ] })
            ] }, model.id))
          }
        )
      ] })
    ] })
  ] });
}

// src/client/store.ts
var CursorAccountStore = class {
  constructor(remote) {
    this.remote = remote;
  }
  snapshot = { busy: false };
  listeners = /* @__PURE__ */ new Set();
  observer;
  disposed = false;
  consumers = 0;
  generation = 0;
  getSnapshot = () => this.snapshot;
  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  publish(next) {
    if (this.disposed) return;
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }
  accept(state) {
    if (this.snapshot.state && state.revision < this.snapshot.state.revision)
      return;
    this.publish({ state, busy: this.snapshot.busy });
  }
  mount() {
    if (this.disposed) return () => {
    };
    this.consumers++;
    if (!this.observer) {
      const observer = new AbortController();
      const generation = this.generation;
      this.observer = observer;
      void (async () => {
        try {
          for await (const state of this.remote.watch(observer.signal)) {
            if (observer.signal.aborted || generation !== this.generation)
              return;
            this.accept(state);
          }
          if (!observer.signal.aborted)
            this.publish({
              ...this.snapshot,
              error: "\u8D26\u53F7\u72B6\u6001\u8FDE\u63A5\u5DF2\u65AD\u5F00\uFF0C\u8BF7\u5237\u65B0\u91CD\u8BD5\u3002"
            });
        } catch {
          if (!observer.signal.aborted)
            this.publish({
              ...this.snapshot,
              error: "\u65E0\u6CD5\u8BFB\u53D6\u8D26\u53F7\u72B6\u6001\uFF0C\u8BF7\u5237\u65B0\u91CD\u8BD5\u3002"
            });
        }
      })();
    }
    let mounted = true;
    return () => {
      if (!mounted) return;
      mounted = false;
      if (--this.consumers === 0) {
        this.observer?.abort();
        this.observer = void 0;
      }
    };
  }
  async run(operation) {
    if (this.snapshot.busy || this.disposed) return;
    const generation = this.generation;
    this.publish({ ...this.snapshot, busy: true, error: void 0 });
    try {
      const result = await operation();
      if (generation !== this.generation) return;
      if (result.ok && result.value) this.accept(result.value);
      else this.publish({ ...this.snapshot, error: "\u8D26\u53F7\u64CD\u4F5C\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002" });
    } catch {
      if (generation === this.generation)
        this.publish({ ...this.snapshot, error: "\u65E0\u6CD5\u8FDE\u63A5\u8D26\u53F7\u670D\u52A1\uFF0C\u8BF7\u91CD\u8BD5\u3002" });
    } finally {
      if (generation === this.generation)
        this.publish({ ...this.snapshot, busy: false });
    }
  }
  login = () => this.run(() => this.remote.startLogin());
  refresh = () => {
    if (this.consumers > 0 && !this.snapshot.busy && !this.disposed) {
      this.observer?.abort();
      this.observer = void 0;
      const release = this.mount();
      release();
    }
    return this.run(() => this.remote.refresh());
  };
  logout = () => this.run(() => this.remote.logout());
  cancel = (attemptId) => this.run(() => this.remote.cancelLogin(attemptId));
  reset = () => {
    this.generation++;
    this.observer?.abort();
    this.observer = void 0;
    this.publish({ busy: false });
    if (this.consumers > 0) {
      const release = this.mount();
      release();
      void this.refresh();
    }
  };
  dispose() {
    this.disposed = true;
    this.observer?.abort();
    this.observer = void 0;
    this.listeners.clear();
  }
};

// src/client/CursorTasksPage.tsx
var import_react2 = require("react");
var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/tasks-store.ts
var CursorTasksStore = class {
  constructor(remote) {
    this.remote = remote;
  }
  state = { models: [], tasks: [], loading: false };
  listeners = /* @__PURE__ */ new Set();
  controller;
  generation = 0;
  selection = 0;
  mounted = 0;
  disposed = false;
  getSnapshot = () => this.state;
  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  publish(next) {
    if (this.disposed) return;
    this.state = next;
    for (const listener of this.listeners) listener();
  }
  accept(task) {
    const previous = this.state.selected;
    if (previous?.id !== task.id || task.revision < previous.revision) return;
    this.publish({
      ...this.state,
      selected: task,
      tasks: this.state.tasks.map(
        (item) => item.id === task.id ? task : item
      )
    });
  }
  observe() {
    this.controller?.abort();
    this.controller = void 0;
    const id = this.state.selected?.id;
    if (!id || !this.mounted || this.disposed) return;
    const controller = new AbortController();
    this.controller = controller;
    const generation = this.generation;
    const selection = this.selection;
    void (async () => {
      try {
        for await (const task of this.remote.watch(id, controller.signal)) {
          if (controller.signal.aborted || generation !== this.generation || selection !== this.selection)
            return;
          this.accept(task);
        }
        if (!controller.signal.aborted)
          this.publish({
            ...this.state,
            error: "\u4EFB\u52A1\u72B6\u6001\u8FDE\u63A5\u5DF2\u65AD\u5F00\uFF0C\u8BF7\u5237\u65B0\u4EFB\u52A1\u3002"
          });
      } catch {
        if (!controller.signal.aborted)
          this.publish({
            ...this.state,
            error: "\u65E0\u6CD5\u8BFB\u53D6\u4EFB\u52A1\u52A8\u6001\uFF0C\u8BF7\u5237\u65B0\u4EFB\u52A1\u3002"
          });
      }
    })();
  }
  mount() {
    if (this.disposed) return () => {
    };
    if (++this.mounted === 1) {
      this.observe();
      void this.refresh();
    }
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      if (--this.mounted === 0) {
        this.controller?.abort();
        this.controller = void 0;
      }
    };
  }
  refresh = async () => {
    if (this.disposed || this.state.loading) return;
    const generation = this.generation;
    this.publish({ ...this.state, loading: true, error: void 0 });
    const models = (async () => {
      try {
        const result = await this.remote.listModels();
        if (generation !== this.generation) return;
        this.publish({
          ...this.state,
          models: result.ok ? result.value : [],
          ...result.ok ? {} : { error: result.error.message }
        });
      } catch {
        if (generation === this.generation)
          this.publish({
            ...this.state,
            models: [],
            error: "\u6682\u65F6\u65E0\u6CD5\u8BFB\u53D6\u6A21\u578B\uFF0C\u53EF\u7EE7\u7EED\u67E5\u770B\u672C\u673A\u4EFB\u52A1\u8BB0\u5F55\u3002"
          });
      }
    })();
    const tasks = (async () => {
      try {
        const result = await this.remote.listTasks();
        if (generation !== this.generation) return;
        if (!result.ok) {
          this.publish({ ...this.state, error: result.error.message });
          return;
        }
        this.publish({ ...this.state, tasks: result.value });
        if (this.state.selected) {
          const selected = this.unwrap(
            await this.remote.snapshot(this.state.selected.id)
          );
          if (generation === this.generation) this.accept(selected);
        }
        if (generation === this.generation) this.observe();
      } catch {
        if (generation === this.generation)
          this.publish({
            ...this.state,
            error: "\u6682\u65F6\u65E0\u6CD5\u8BFB\u53D6\u4EFB\u52A1\u5217\u8868\uFF0C\u8BF7\u5237\u65B0\u91CD\u8BD5\u3002"
          });
      }
    })();
    await Promise.allSettled([models, tasks]);
    if (generation === this.generation)
      this.publish({ ...this.state, loading: false });
  };
  unwrap(result) {
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  }
  message(error) {
    return error instanceof Error ? error.message : "\u65E0\u6CD5\u8FDE\u63A5 Cursor \u4EFB\u52A1\u670D\u52A1\uFF0C\u8BF7\u91CD\u8BD5\u3002";
  }
  async run(action, operation, select = false) {
    if (this.disposed || this.state.action) return;
    const generation = this.generation;
    const selection = select ? ++this.selection : this.selection;
    if (select) {
      this.controller?.abort();
      this.controller = void 0;
    }
    this.publish({ ...this.state, action, error: void 0 });
    try {
      const task = this.unwrap(await operation());
      if (generation !== this.generation || selection !== this.selection)
        return;
      if (select) {
        this.publish({
          ...this.state,
          selected: task,
          tasks: [
            task,
            ...this.state.tasks.filter((item) => item.id !== task.id)
          ]
        });
        this.observe();
      } else this.accept(task);
    } catch (error) {
      if (generation === this.generation && selection === this.selection)
        this.publish({ ...this.state, error: this.message(error) });
      if (select && generation === this.generation && selection === this.selection)
        this.observe();
    } finally {
      if (generation === this.generation && selection === this.selection)
        this.publish({ ...this.state, action: void 0 });
    }
  }
  create = (input) => this.run("create", () => this.remote.create(input), true);
  select = (id) => this.run("select", () => this.remote.snapshot(id), true);
  resume = (id) => this.run("resume", () => this.remote.resume(id), true);
  send = (id, text) => this.run("send", () => this.remote.send(id, text));
  cancel = async (id, attemptId) => {
    const generation = this.generation;
    const selection = this.selection;
    try {
      const task = this.unwrap(await this.remote.cancel(id, attemptId));
      if (generation === this.generation && selection === this.selection)
        this.accept(task);
    } catch (error) {
      if (generation === this.generation && selection === this.selection)
        this.publish({ ...this.state, error: this.message(error) });
    }
  };
  reset = () => {
    this.generation++;
    this.selection++;
    this.controller?.abort();
    this.controller = void 0;
    this.publish({ models: [], tasks: [], loading: false });
    if (this.mounted) void this.refresh();
  };
  dispose() {
    this.disposed = true;
    this.generation++;
    this.controller?.abort();
    this.listeners.clear();
  }
};
function isAbsoluteWorkspace(value) {
  return /^(?:[A-Za-z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+|\/)/.test(value.trim());
}

// src/client/CursorTasksPage.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var box = {
  border: "0.5px solid var(--dsw-alias-settings-card-stroke)",
  borderRadius: 12,
  padding: 16,
  background: "var(--dsw-alias-settings-card-fill)",
  minWidth: 0
};
var control = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid var(--dsw-alias-settings-card-stroke)",
  borderRadius: 8,
  padding: "8px 10px",
  font: "inherit",
  background: "var(--dsw-alias-settings-card-fill)",
  color: "var(--dsw-alias-label-primary)"
};
var note = {
  margin: 0,
  fontSize: 13,
  lineHeight: "20px",
  color: "var(--dsw-alias-label-tertiary)"
};
var row = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 8
};
var statusLabel = (status) => ({
  running: "\u8FD0\u884C\u4E2D",
  stored: "\u5F85\u6062\u590D",
  unavailable: "\u4E0D\u53EF\u7EE7\u7EED",
  idle: "\u5C31\u7EEA"
})[status] || "\u72B6\u6001\u672A\u77E5";
function CursorTasksPage({
  controller,
  account
}) {
  const state = (0, import_react2.useSyncExternalStore)(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot
  );
  const [cwd, setCwd] = (0, import_react2.useState)("");
  const [model, setModel] = (0, import_react2.useState)("");
  const [text, setText] = (0, import_react2.useState)("");
  const [validation, setValidation] = (0, import_react2.useState)("");
  (0, import_react2.useEffect)(() => controller.mount(), [controller]);
  const selected = state.selected;
  const chosenModel = state.models.some((item) => item.id === model) ? model : state.models[0]?.id || "";
  const busy = state.action !== void 0;
  const create = (event) => {
    event.preventDefault();
    if (!isAbsoluteWorkspace(cwd)) {
      setValidation(
        "\u8BF7\u8F93\u5165\u5DE5\u4F5C\u533A\u7684\u7EDD\u5BF9\u8DEF\u5F84\uFF0C\u4F8B\u5982 I:\\project \u6216 /home/user/project\u3002"
      );
      return;
    }
    if (!chosenModel) {
      setValidation("\u8BF7\u5148\u767B\u5F55 Cursor \u5E76\u9009\u62E9\u53EF\u7528\u6A21\u578B\u3002");
      return;
    }
    setValidation("");
    void controller.create({ cwd: cwd.trim(), model: chosenModel });
  };
  const send = (event) => {
    event.preventDefault();
    if (!selected || !text.trim()) return;
    const prompt = text.trim();
    void controller.send(selected.id, prompt).then(() => {
      if (!controller.getSnapshot().error) setText("");
    });
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    "div",
    {
      style: {
        height: "100%",
        overflow: "auto",
        boxSizing: "border-box",
        padding: "24px clamp(12px, 3vw, 32px)",
        color: "var(--dsw-alias-label-primary)"
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
        "main",
        {
          style: {
            maxWidth: 1e3,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            minWidth: 0
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("header", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h1", { style: { fontSize: 22, margin: "0 0 8px" }, children: "Cursor \u4EFB\u52A1" }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: note, children: "\u5728\u6307\u5B9A\u5DE5\u4F5C\u533A\u4F7F\u7528 Cursor \u6267\u884C\u4EFB\u52A1\u3002\u4EFB\u52A1\u8BB0\u5F55\u4E0E\u666E\u901A\u804A\u5929\u5206\u522B\u4FDD\u5B58\u3002" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("details", { style: box, children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("summary", { style: { cursor: "pointer" }, children: "Cursor \u8D26\u53F7\u4E0E\u767B\u5F55" }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { marginTop: 12 }, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CursorAccountCard, { controller: account }) })
            ] }),
            (state.error || validation) && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "p",
              {
                role: "alert",
                style: { ...note, color: "var(--dsw-alias-state-warn-label)" },
                children: validation || state.error
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { style: box, "aria-label": "\u521B\u5EFA Cursor \u4EFB\u52A1", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { style: { margin: "0 0 12px", fontSize: 16 }, children: "\u65B0\u5EFA\u4EFB\u52A1" }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
                "form",
                {
                  onSubmit: create,
                  style: { display: "flex", flexDirection: "column", gap: 12 },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { children: [
                      "\u5DE5\u4F5C\u533A\u7EDD\u5BF9\u8DEF\u5F84",
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                        "input",
                        {
                          style: { ...control, marginTop: 6 },
                          value: cwd,
                          onChange: (event) => setCwd(event.target.value),
                          placeholder: "\u4F8B\u5982 I:\\project \u6216 /home/user/project",
                          required: true,
                          disabled: busy
                        }
                      )
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { children: [
                      "\u6A21\u578B",
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
                        "select",
                        {
                          style: { ...control, marginTop: 6 },
                          value: chosenModel,
                          onChange: (event) => setModel(event.target.value),
                          required: true,
                          disabled: busy || state.models.length === 0,
                          children: [
                            state.models.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: "", children: "\u6682\u65E0\u53EF\u7528\u6A21\u578B\uFF0C\u8BF7\u767B\u5F55\u540E\u5237\u65B0" }),
                            state.models.map((item) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: item.id, children: item.name }, item.id))
                          ]
                        }
                      )
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: row, children: [
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                        import_dsh_client_ui_primitives2.Button,
                        {
                          type: "submit",
                          disabled: busy || !cwd.trim() || !chosenModel,
                          children: state.action === "create" ? "\u6B63\u5728\u521B\u5EFA\u2026" : "\u521B\u5EFA\u4EFB\u52A1"
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                        import_dsh_client_ui_primitives2.Button,
                        {
                          disabled: state.loading,
                          onClick: () => void controller.refresh(),
                          children: state.loading ? "\u6B63\u5728\u5237\u65B0\u2026" : "\u5237\u65B0\u4EFB\u52A1\u4E0E\u6A21\u578B"
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: note, children: "\u9ED8\u8BA4\u53EA\u8BFB\uFF1B\u521B\u5EFA\u540E\u8F93\u5165\u9700\u6C42\u624D\u4F1A\u5F00\u59CB\u8FD0\u884C\u3002" })
                    ] })
                  ]
                }
              )
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
              "section",
              {
                style: { ...box, display: "flex", flexDirection: "column", gap: 12 },
                "aria-label": "Cursor \u4EFB\u52A1\u8BB0\u5F55",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: row, children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { style: { margin: 0, fontSize: 16 }, children: "\u4EFB\u52A1\u8BB0\u5F55" }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
                      "select",
                      {
                        "aria-label": "\u9009\u62E9\u5DF2\u6709\u4EFB\u52A1",
                        style: { ...control, flex: "1 1 240px", width: "auto" },
                        value: selected?.id || "",
                        disabled: busy,
                        onChange: (event) => {
                          if (event.target.value)
                            void controller.select(event.target.value);
                        },
                        children: [
                          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: "", children: "\u9009\u62E9\u5DF2\u6709\u4EFB\u52A1" }),
                          state.tasks.map((task) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("option", { value: task.id, children: [
                            task.cwd,
                            " \xB7 ",
                            statusLabel(task.status)
                          ] }, task.id))
                        ]
                      }
                    )
                  ] }),
                  !selected && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: note, children: state.tasks.length ? "\u9009\u62E9\u4EFB\u52A1\u67E5\u770B\u8BB0\u5F55\uFF0C\u6216\u65B0\u5EFA\u4EFB\u52A1\u3002" : "\u8FD8\u6CA1\u6709 Cursor \u4EFB\u52A1\u3002\u586B\u5199\u5DE5\u4F5C\u533A\u5E76\u521B\u5EFA\u7B2C\u4E00\u4E2A\u4EFB\u52A1\u3002" }),
                  selected && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { ...note, overflowWrap: "anywhere" }, children: [
                      selected.cwd,
                      " \xB7 ",
                      selected.model,
                      " \xB7",
                      " ",
                      selected.permissionMode === "readonly" ? "\u53EA\u8BFB" : selected.permissionMode === "workspace-write" ? "\u5DE5\u4F5C\u533A\u5199\u5165" : "Shell",
                      " ",
                      "\xB7 ",
                      statusLabel(selected.status)
                    ] }),
                    selected.status === "stored" && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: row, children: [
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: note, children: "\u6B64\u4EFB\u52A1\u4FDD\u5B58\u5728\u672C\u673A\uFF0C\u6062\u590D\u540E\u53EF\u7EE7\u7EED\u5BF9\u8BDD\u3002" }),
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                        import_dsh_client_ui_primitives2.Button,
                        {
                          disabled: busy,
                          onClick: () => void controller.resume(selected.id),
                          children: state.action === "resume" ? "\u6B63\u5728\u6062\u590D\u2026" : "\u6062\u590D\u4EFB\u52A1"
                        }
                      )
                    ] }),
                    statusLabel(selected.status) === "\u4E0D\u53EF\u7EE7\u7EED" && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                      "p",
                      {
                        role: "alert",
                        style: {
                          ...note,
                          color: "var(--dsw-alias-state-warn-label)"
                        },
                        children: "\u6B64\u4EFB\u52A1\u5F53\u524D\u65E0\u6CD5\u7EE7\u7EED\uFF0C\u8BF7\u67E5\u770B\u4E0B\u65B9\u8BB0\u5F55\u5E76\u65B0\u5EFA\u4EFB\u52A1\u3002"
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
                      "div",
                      {
                        role: "log",
                        "aria-label": "\u4EFB\u52A1\u6D88\u606F\u4E0E\u5DE5\u5177\u8BB0\u5F55",
                        "aria-live": "polite",
                        style: {
                          display: "flex",
                          flexDirection: "column",
                          gap: 12,
                          maxHeight: "50vh",
                          overflow: "auto",
                          padding: "4px 0"
                        },
                        children: [
                          selected.messages.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: note, children: selected.status === "idle" ? "\u4EFB\u52A1\u5DF2\u51C6\u5907\u597D\uFF0C\u8BF7\u5728\u4E0B\u65B9\u8F93\u5165\u9700\u6C42\u3002" : selected.status === "running" ? "\u6B63\u5728\u7B49\u5F85 Cursor \u8F93\u51FA\u2026" : selected.status === "stored" ? "\u6062\u590D\u4EFB\u52A1\u540E\u53EF\u7EE7\u7EED\u5BF9\u8BDD\u3002" : "\u6B64\u4EFB\u52A1\u5F53\u524D\u4E0D\u53EF\u7EE7\u7EED\uFF0C\u8BF7\u65B0\u5EFA\u4EFB\u52A1\u3002" }),
                          selected.messages.map((message) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                            "article",
                            {
                              style: {
                                borderLeft: "2px solid var(--dsw-alias-settings-card-stroke)",
                                paddingLeft: 12,
                                minWidth: 0
                              },
                              children: message.role === "tool" || message.role === "thinking" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("details", { children: [
                                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("summary", { style: { cursor: "pointer", fontSize: 13 }, children: [
                                  message.role === "thinking" ? "\u601D\u8003\u8FC7\u7A0B" : `\u5DE5\u5177\uFF1A${message.toolName || "\u5DE5\u5177\u8C03\u7528"}`,
                                  " ",
                                  message.toolStatus === "running" ? "\u6267\u884C\u4E2D" : message.toolStatus === "completed" ? "\u5DF2\u5B8C\u6210" : message.toolStatus === "error" ? "\u5931\u8D25" : ""
                                ] }),
                                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                                  "pre",
                                  {
                                    style: {
                                      margin: "8px 0 0",
                                      whiteSpace: "pre-wrap",
                                      overflowWrap: "anywhere",
                                      fontFamily: "inherit",
                                      fontSize: 13
                                    },
                                    children: message.text
                                  }
                                )
                              ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
                                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { style: { fontSize: 13 }, children: message.role === "user" ? "\u4F60" : "Cursor" }),
                                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                                  "p",
                                  {
                                    style: {
                                      whiteSpace: "pre-wrap",
                                      overflowWrap: "anywhere",
                                      margin: "6px 0 0",
                                      lineHeight: "1.6"
                                    },
                                    children: message.text
                                  }
                                )
                              ] })
                            },
                            message.id
                          ))
                        ]
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
                      "form",
                      {
                        onSubmit: send,
                        style: { display: "flex", flexDirection: "column", gap: 8 },
                        children: [
                          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { children: [
                            "\u4EFB\u52A1\u9700\u6C42",
                            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                              "textarea",
                              {
                                style: {
                                  ...control,
                                  marginTop: 6,
                                  minHeight: 96,
                                  resize: "vertical"
                                },
                                value: text,
                                onChange: (event) => setText(event.target.value),
                                required: true,
                                disabled: busy || selected.status !== "idle",
                                placeholder: selected.status === "unavailable" ? "\u6B64\u4EFB\u52A1\u4E0D\u53EF\u7EE7\u7EED\uFF0C\u8BF7\u65B0\u5EFA\u4EFB\u52A1" : selected.status === "stored" ? "\u5148\u6062\u590D\u4EFB\u52A1\uFF0C\u518D\u7EE7\u7EED\u5BF9\u8BDD" : "\u63CF\u8FF0\u5E0C\u671B\u5B8C\u6210\u7684\u4EFB\u52A1\u2026"
                              }
                            )
                          ] }),
                          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: row, children: [
                            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                              import_dsh_client_ui_primitives2.Button,
                              {
                                type: "submit",
                                disabled: busy || selected.status !== "idle" || !text.trim(),
                                children: state.action === "send" ? "\u6B63\u5728\u53D1\u9001\u2026" : "\u53D1\u9001"
                              }
                            ),
                            selected.status === "running" && selected.attemptId && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                              import_dsh_client_ui_primitives2.Button,
                              {
                                onClick: () => void controller.cancel(selected.id, selected.attemptId),
                                children: "\u53D6\u6D88\u8FD0\u884C"
                              }
                            ),
                            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: note, children: "\u5173\u95ED\u9875\u9762\u4E0D\u4F1A\u53D6\u6D88\u6B63\u5728\u8FD0\u884C\u7684\u4EFB\u52A1\u3002" })
                          ] })
                        ]
                      }
                    )
                  ] })
                ]
              }
            )
          ]
        }
      )
    }
  );
}
function CursorTasksIcon({ size = 20 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.6",
      "aria-hidden": "true",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M5 4h10l4 4v12H5z" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M14 4v5h5M8 13l2 2-2 2m4 0h4" })
      ]
    }
  );
}

// src/client/index.ts
var inject = ["slots", "remote"];
async function apply(ctx) {
  await ctx.remote.$mount(typert_remote_client_default);
  ctx.plugin({
    inject: ["slots", "remote", "remote.cursorAccount"],
    apply: applyAccount
  });
}
function applyAccount(ctx) {
  const controller = new CursorAccountStore(ctx.remote.cursorAccount);
  ctx.on("connection/reset", controller.reset);
  ctx.effect(
    () => () => controller.dispose(),
    "cursor-account: \u9875\u9762\u72B6\u6001\u751F\u547D\u5468\u671F"
  );
  ctx.slots.inject(
    "settings.section",
    () => ctx.slots.register(
      {
        name: "settings.section",
        id: "cursor",
        order: 15,
        label: "Cursor",
        inject: () => ({ controller })
      },
      CursorAccountCard
    )
  );
  ctx.slots.inject(
    "settings.models.footer",
    () => ctx.slots.register(
      {
        name: "settings.models.footer",
        id: "cursor-account",
        order: 100,
        inject: () => ({ controller })
      },
      CursorAccountCard
    )
  );
  ctx.plugin({
    inject: ["slots", "remote", "remote.cursorTasks"],
    apply(taskCtx) {
      const tasks = new CursorTasksStore(taskCtx.remote.cursorTasks);
      taskCtx.on("connection/reset", tasks.reset);
      taskCtx.effect(
        () => () => tasks.dispose(),
        "cursor-tasks: \u9875\u9762\u72B6\u6001\u751F\u547D\u5468\u671F"
      );
      const panel = "cursor-tasks";
      taskCtx.slots.inject(
        "main",
        () => taskCtx.slots.register(
          {
            name: "main",
            key: panel,
            inject: () => ({ controller: tasks, account: controller })
          },
          CursorTasksPage
        )
      );
      taskCtx.slots.inject(
        "sidebar.panellist",
        () => taskCtx.slots.register(
          {
            name: "sidebar.panellist",
            id: panel,
            order: 20,
            label: "Cursor \u4EFB\u52A1"
          },
          CursorTasksIcon
        )
      );
    }
  });
}
return module.exports; } });
//# sourceMappingURL=client.js.map
