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
    })).optional(),
    "variants": import_zod.z.array(import_zod.z.object({
      "params": import_zod.z.array(import_zod.z.object({
        "id": import_zod.z.string(),
        "value": import_zod.z.string()
      })),
      "displayName": import_zod.z.string(),
      "description": import_zod.z.string().optional(),
      "isDefault": import_zod.z.boolean().optional(),
      "isMaxMode": import_zod.z.boolean().optional()
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
    })).optional(),
    "variants": import_zod.z.array(import_zod.z.object({
      "params": import_zod.z.array(import_zod.z.object({
        "id": import_zod.z.string(),
        "value": import_zod.z.string()
      })),
      "displayName": import_zod.z.string(),
      "description": import_zod.z.string().optional(),
      "isDefault": import_zod.z.boolean().optional(),
      "isMaxMode": import_zod.z.boolean().optional()
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
    })).optional(),
    "variants": import_zod.z.array(import_zod.z.object({
      "params": import_zod.z.array(import_zod.z.object({
        "id": import_zod.z.string(),
        "value": import_zod.z.string()
      })),
      "displayName": import_zod.z.string(),
      "description": import_zod.z.string().optional(),
      "isDefault": import_zod.z.boolean().optional(),
      "isMaxMode": import_zod.z.boolean().optional()
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
    })).optional(),
    "variants": import_zod.z.array(import_zod.z.object({
      "params": import_zod.z.array(import_zod.z.object({
        "id": import_zod.z.string(),
        "value": import_zod.z.string()
      })),
      "displayName": import_zod.z.string(),
      "description": import_zod.z.string().optional(),
      "isDefault": import_zod.z.boolean().optional(),
      "isMaxMode": import_zod.z.boolean().optional()
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
    })).optional(),
    "variants": import_zod.z.array(import_zod.z.object({
      "params": import_zod.z.array(import_zod.z.object({
        "id": import_zod.z.string(),
        "value": import_zod.z.string()
      })),
      "displayName": import_zod.z.string(),
      "description": import_zod.z.string().optional(),
      "isDefault": import_zod.z.boolean().optional(),
      "isMaxMode": import_zod.z.boolean().optional()
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
    })).optional(),
    "variants": import_zod.z.array(import_zod.z.object({
      "params": import_zod.z.array(import_zod.z.object({
        "id": import_zod.z.string(),
        "value": import_zod.z.string()
      })),
      "displayName": import_zod.z.string(),
      "description": import_zod.z.string().optional(),
      "isDefault": import_zod.z.boolean().optional(),
      "isMaxMode": import_zod.z.boolean().optional()
    })).optional()
  })),
  "error": import_zod.z.object({
    "code": import_zod.z.string(),
    "message": import_zod.z.string()
  }).optional()
});
var dsh_cursor_agent_cursorAccount_cancelLogin_parameter_0_strict$schema$value;
var dsh_cursor_agent_cursorAccount_cancelLogin_parameter_0_strict$schema = () => dsh_cursor_agent_cursorAccount_cancelLogin_parameter_0_strict$schema$value ??= import_zod.z.string();
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
        jsonSchema: { "type": "object", "properties": { "status": { "type": "string", "enum": ["signed-out", "waiting", "verifying", "connected", "error"] }, "credentialSource": { "type": "string", "enum": ["none", "saved", "environment"] }, "revision": { "type": "number" }, "attemptId": { "type": "string" }, "loginUrl": { "type": "string" }, "email": { "type": "string" }, "apiKeyExpiresAtMs": { "type": "number" }, "models": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "displayName": { "type": "string" }, "parameters": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "displayName": { "type": "string" }, "values": { "type": "array", "items": { "type": "object", "properties": { "value": { "type": "string" }, "displayName": { "type": "string" } }, "required": ["value"], "additionalProperties": true } } }, "required": ["id", "values"], "additionalProperties": true } }, "variants": { "type": "array", "items": { "type": "object", "properties": { "params": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "value": { "type": "string" } }, "required": ["id", "value"], "additionalProperties": true } }, "displayName": { "type": "string" }, "description": { "type": "string" }, "isDefault": { "type": "boolean" }, "isMaxMode": { "type": "boolean" } }, "required": ["params", "displayName"], "additionalProperties": true } } }, "required": ["id", "displayName"], "additionalProperties": true } }, "error": { "type": "object", "properties": { "code": { "type": "string" }, "message": { "type": "string" } }, "required": ["code", "message"], "additionalProperties": true } }, "required": ["status", "credentialSource", "revision", "models"], "additionalProperties": true }
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
        jsonSchema: { "type": "object", "properties": { "status": { "type": "string", "enum": ["signed-out", "waiting", "verifying", "connected", "error"] }, "credentialSource": { "type": "string", "enum": ["none", "saved", "environment"] }, "revision": { "type": "number" }, "attemptId": { "type": "string" }, "loginUrl": { "type": "string" }, "email": { "type": "string" }, "apiKeyExpiresAtMs": { "type": "number" }, "models": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "displayName": { "type": "string" }, "parameters": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "displayName": { "type": "string" }, "values": { "type": "array", "items": { "type": "object", "properties": { "value": { "type": "string" }, "displayName": { "type": "string" } }, "required": ["value"], "additionalProperties": true } } }, "required": ["id", "values"], "additionalProperties": true } }, "variants": { "type": "array", "items": { "type": "object", "properties": { "params": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "value": { "type": "string" } }, "required": ["id", "value"], "additionalProperties": true } }, "displayName": { "type": "string" }, "description": { "type": "string" }, "isDefault": { "type": "boolean" }, "isMaxMode": { "type": "boolean" } }, "required": ["params", "displayName"], "additionalProperties": true } } }, "required": ["id", "displayName"], "additionalProperties": true } }, "error": { "type": "object", "properties": { "code": { "type": "string" }, "message": { "type": "string" } }, "required": ["code", "message"], "additionalProperties": true } }, "required": ["status", "credentialSource", "revision", "models"], "additionalProperties": true }
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
        jsonSchema: { "type": "object", "properties": { "status": { "type": "string", "enum": ["signed-out", "waiting", "verifying", "connected", "error"] }, "credentialSource": { "type": "string", "enum": ["none", "saved", "environment"] }, "revision": { "type": "number" }, "attemptId": { "type": "string" }, "loginUrl": { "type": "string" }, "email": { "type": "string" }, "apiKeyExpiresAtMs": { "type": "number" }, "models": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "displayName": { "type": "string" }, "parameters": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "displayName": { "type": "string" }, "values": { "type": "array", "items": { "type": "object", "properties": { "value": { "type": "string" }, "displayName": { "type": "string" } }, "required": ["value"], "additionalProperties": true } } }, "required": ["id", "values"], "additionalProperties": true } }, "variants": { "type": "array", "items": { "type": "object", "properties": { "params": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "value": { "type": "string" } }, "required": ["id", "value"], "additionalProperties": true } }, "displayName": { "type": "string" }, "description": { "type": "string" }, "isDefault": { "type": "boolean" }, "isMaxMode": { "type": "boolean" } }, "required": ["params", "displayName"], "additionalProperties": true } } }, "required": ["id", "displayName"], "additionalProperties": true } }, "error": { "type": "object", "properties": { "code": { "type": "string" }, "message": { "type": "string" } }, "required": ["code", "message"], "additionalProperties": true } }, "required": ["status", "credentialSource", "revision", "models"], "additionalProperties": true }
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
        jsonSchema: { "type": "object", "properties": { "status": { "type": "string", "enum": ["signed-out", "waiting", "verifying", "connected", "error"] }, "credentialSource": { "type": "string", "enum": ["none", "saved", "environment"] }, "revision": { "type": "number" }, "attemptId": { "type": "string" }, "loginUrl": { "type": "string" }, "email": { "type": "string" }, "apiKeyExpiresAtMs": { "type": "number" }, "models": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "displayName": { "type": "string" }, "parameters": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "displayName": { "type": "string" }, "values": { "type": "array", "items": { "type": "object", "properties": { "value": { "type": "string" }, "displayName": { "type": "string" } }, "required": ["value"], "additionalProperties": true } } }, "required": ["id", "values"], "additionalProperties": true } }, "variants": { "type": "array", "items": { "type": "object", "properties": { "params": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "value": { "type": "string" } }, "required": ["id", "value"], "additionalProperties": true } }, "displayName": { "type": "string" }, "description": { "type": "string" }, "isDefault": { "type": "boolean" }, "isMaxMode": { "type": "boolean" } }, "required": ["params", "displayName"], "additionalProperties": true } } }, "required": ["id", "displayName"], "additionalProperties": true } }, "error": { "type": "object", "properties": { "code": { "type": "string" }, "message": { "type": "string" } }, "required": ["code", "message"], "additionalProperties": true } }, "required": ["status", "credentialSource", "revision", "models"], "additionalProperties": true }
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
        jsonSchema: { "type": "object", "properties": { "status": { "type": "string", "enum": ["signed-out", "waiting", "verifying", "connected", "error"] }, "credentialSource": { "type": "string", "enum": ["none", "saved", "environment"] }, "revision": { "type": "number" }, "attemptId": { "type": "string" }, "loginUrl": { "type": "string" }, "email": { "type": "string" }, "apiKeyExpiresAtMs": { "type": "number" }, "models": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "displayName": { "type": "string" }, "parameters": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "displayName": { "type": "string" }, "values": { "type": "array", "items": { "type": "object", "properties": { "value": { "type": "string" }, "displayName": { "type": "string" } }, "required": ["value"], "additionalProperties": true } } }, "required": ["id", "values"], "additionalProperties": true } }, "variants": { "type": "array", "items": { "type": "object", "properties": { "params": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "value": { "type": "string" } }, "required": ["id", "value"], "additionalProperties": true } }, "displayName": { "type": "string" }, "description": { "type": "string" }, "isDefault": { "type": "boolean" }, "isMaxMode": { "type": "boolean" } }, "required": ["params", "displayName"], "additionalProperties": true } } }, "required": ["id", "displayName"], "additionalProperties": true } }, "error": { "type": "object", "properties": { "code": { "type": "string" }, "message": { "type": "string" } }, "required": ["code", "message"], "additionalProperties": true } }, "required": ["status", "credentialSource", "revision", "models"], "additionalProperties": true }
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
        jsonSchema: { "type": "object", "properties": { "status": { "type": "string", "enum": ["signed-out", "waiting", "verifying", "connected", "error"] }, "credentialSource": { "type": "string", "enum": ["none", "saved", "environment"] }, "revision": { "type": "number" }, "attemptId": { "type": "string" }, "loginUrl": { "type": "string" }, "email": { "type": "string" }, "apiKeyExpiresAtMs": { "type": "number" }, "models": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "displayName": { "type": "string" }, "parameters": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "displayName": { "type": "string" }, "values": { "type": "array", "items": { "type": "object", "properties": { "value": { "type": "string" }, "displayName": { "type": "string" } }, "required": ["value"], "additionalProperties": true } } }, "required": ["id", "values"], "additionalProperties": true } }, "variants": { "type": "array", "items": { "type": "object", "properties": { "params": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "value": { "type": "string" } }, "required": ["id", "value"], "additionalProperties": true } }, "displayName": { "type": "string" }, "description": { "type": "string" }, "isDefault": { "type": "boolean" }, "isMaxMode": { "type": "boolean" } }, "required": ["params", "displayName"], "additionalProperties": true } } }, "required": ["id", "displayName"], "additionalProperties": true } }, "error": { "type": "object", "properties": { "code": { "type": "string" }, "message": { "type": "string" } }, "required": ["code", "message"], "additionalProperties": true } }, "required": ["status", "credentialSource", "revision", "models"], "additionalProperties": true }
      },
      sourceLocation: { "file": "packages/cursor-agent/src/host/remote-service.ts", "line": 52, "column": 3 }
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
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: secondary, children: "\u767B\u5F55\u540E\uFF0C\u5728\u666E\u901A\u804A\u5929\u7684\u6A21\u578B\u83DC\u5355\u4E2D\u9009\u62E9 Cursor \u6A21\u578B\u3002" }),
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
}
return module.exports; } });
//# sourceMappingURL=client.js.map
