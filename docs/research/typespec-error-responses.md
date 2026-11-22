# How TypeSpec models error responses

Research for [issue #6](https://github.com/chuvayva/ai-for-developers-project-386/issues/6), a child of the "Booking contract" map (issue #1). This file records facts. It does not choose an error model.

## Versions checked

Installed in `api/node_modules` from the ranges in `api/package.json`:

| Package              | Version |
| -------------------- | ------- |
| `@typespec/compiler` | 1.18.0  |
| `@typespec/http`     | 1.18.0  |
| `@typespec/openapi`  | 1.18.0  |
| `@typespec/openapi3` | 1.18.0  |
| `openapi-typescript` | 7.13.0  |

Every YAML and TypeScript excerpt below is real output. I compiled scratch `.tsp` files outside the repo with `tsp compile` and ran `openapi-typescript` on the result, both through the `api` package's `node_modules`. The emitter used the repo's settings (`api/tspconfig.yaml`), so the output is OpenAPI 3.0.0.

In the type excerpts I dropped the `headers: { [name: string]: unknown }` member that `openapi-typescript` adds to every response, except where the headers matter. The repo's commit hook runs oxfmt on Markdown, and it rewrote the quotes and indentation of some TypeScript excerpts. `openapi-typescript` itself prints double quotes and four-space indentation.

## Short answer

- TypeSpec has no error-specific response syntax. An operation's return type is a union, and each variant becomes one response. The status code of a variant comes from a `@statusCode` property. Without one, a model marked `@error` becomes the OpenAPI `default` response and anything else becomes `200`.
- `@error` leaves no trace in the OpenAPI document apart from that `default` rule. A model with `@statusCode _: 409` emits the same response with or without `@error`.
- `@typespec/http` ships status-only models (`ConflictResponse`, `NotFoundResponse`, `BadRequestResponse` and others). They carry a status code and no body.
- No package in the pinned set has a problem-details (RFC 9457) model. The upstream request is still open. A hand-written model works and can emit `application/problem+json`.
- `openapi-typescript` types each response under its status key: `operations["x"]["responses"][409]["content"]["application/json"]`. The `default` response sits under the key `default`. It generates no error union and no helper types.

## The rules TypeSpec applies

### The return type is a union of responses

The OpenAPI emitter docs say "The operation's return type(s) translate into OpenAPI responses" ([typespec.io, OpenAPI 3 emitter, Responses](https://typespec.io/docs/emitters/openapi3/openapi/)). Each union variant is processed on its own. A variant that is itself a union, such as an alias `NotFoundError | ApiError`, is flattened into the operation's responses.

### How the status code is chosen

`processResponseType` in `@typespec/http` (`dist/src/responses.js`, lines 95 to 108) reads the explicit status codes first. If the variant has none, it applies these fallbacks in order:

1. The variant is an `@error` model: status `"*"`, which the OpenAPI emitter writes as `default`.
2. The variant is `void`: `204`.
3. Anything else: `200`.

The HTTP library docs give the same default: "`4xx,5xx` if response is marked with `@error`", "`200` otherwise" ([typespec.io, HTTP operations, Status codes](https://typespec.io/docs/libraries/http/operations/)).

### `@statusCode`

`@statusCode` marks a model property as the status code. The property type must be an integer literal or a union of them (`@typespec/http`, `lib/decorators.tsp`, line 221: "Property type must be a status code integer or a union of status code integer"). The property does not appear in the body schema.

Three forms compile:

- A literal, `@statusCode _: 409`, gives one response.
- A union, `@statusCode _: 400 | 422`, gives one response per code, each with the same body.
- A range, `@minValue(400) @maxValue(499) @statusCode _: int32`, gives the OpenAPI key `4XX`. OpenAPI 3.0 accepts only the ranges `1XX` to `5XX`. Any other range is the emitter error `unsupported-status-code-range` (`@typespec/openapi3`, `dist/src/lib.js`, line 280).

### `@error`

`@error` is a compiler built-in that applies to models only: `extern dec error(target: Model)` (`@typespec/compiler`, `lib/std/decorators.tsp`, line 98). Its effects on the HTTP and OpenAPI output are:

- A response with no explicit status code becomes `default` (rule 1 above).
- `@errorsDoc` on the operation supplies the description for `@error` responses, and `@returnsDoc` supplies it for the others (`responses.js`, `getResponseDescription`, lines 218 to 224).
- Derived models inherit it. `isErrorModel` walks the `baseModel` chain (`@typespec/compiler`, `dist/src/lib/decorators.js`, lines 266 to 278).

The OpenAPI document has no marker for `@error`. Other emitters can read the flag through the compiler's `isErrorModel`. This research did not examine any of them.

### Response descriptions

`getResponseDescription` picks the first that exists: the `@doc` of the response model when the model is an envelope (it has `@statusCode`, `@body` or a similar property), then `@errorsDoc` or `@returnsDoc` on the operation, then a built-in text for the status code. Built-in texts exist for 200, 201, 202, 204, 301, 304, 400, 401, 403, 404, 409, 412 and 503 (`@typespec/http`, `dist/src/decorators.js`, `getStatusCodeDescription`, lines 222 to 271). Other 4xx codes get "Client error", 5xx codes get "Server error", and `default` gets "An unexpected error response." (`@typespec/openapi3`, `dist/src/openapi.js`, line 826).

## Each form and what it emits

All examples share this model:

```typespec
model Booking {
  id: string;
}
```

### 1. `@error` model with no status code: the `default` response

```typespec
@error
model ApiError {
  code: string;
  message: string;
}

@route("/a") @get op a(): Booking | ApiError;
```

```yaml
responses:
  '200':
    description: The request has succeeded.
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/Booking'
  default:
    description: An unexpected error response.
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/ApiError'
```

```ts
responses: {
    /** @description The request has succeeded. */
    200: {
        content: {
            "application/json": components["schemas"]["Booking"];
        };
    };
    /** @description An unexpected error response. */
    default: {
        content: {
            "application/json": components["schemas"]["ApiError"];
        };
    };
};
```

`@defaultResponse` from `@typespec/openapi` produces the same `default` response for a model that is not an error. Its doc comment says it "differs from the compiler built-in `@error` decorator as this does not necessarily represent an error" (`@typespec/openapi`, `lib/decorators.tsp`, lines 36 to 48). I compiled it and the output matched the block above, with the model name swapped.

Two `@error` models without status codes on one operation share the `default` response as `anyOf`, and the generated body type is `components["schemas"]["ErrA"] | components["schemas"]["ErrB"]`.

### 2. `@error` model with `@statusCode`: a specific status

```typespec
@error
model SlotTakenError {
  @statusCode _: 409;
  code: "slot_taken";
  message: string;
}

@route("/b") @post op b(): Booking | SlotTakenError;
```

```yaml
'409':
  description: The request conflicts with the current state of the server.
  content:
    application/json:
      schema:
        $ref: '#/components/schemas/SlotTakenError'
```

```yaml
SlotTakenError:
  type: object
  required:
    - code
    - message
  properties:
    code:
      type: string
      enum:
        - slot_taken
    message:
      type: string
```

```ts
SlotTakenError: {
  /** @enum {string} */
  code: 'slot_taken';
  message: string;
}
```

```ts
/** @description The request conflicts with the current state of the server. */
409: {
    content: {
        "application/json": components["schemas"]["SlotTakenError"];
    };
};
```

The `_` property is absent from the schema. A string literal type becomes a one-value `enum` and then a TypeScript literal type.

The same model without `@error` (a plain model with `@statusCode _: 409`) emits an identical `409` response. I compiled both and compared them.

### 3. Ready-made response models

`@typespec/http` defines them in `lib/main.tsp` (lines 16 to 96):

```typespec
model Response<Status> {
  @statusCode
  statusCode: Status;
}

model BadRequestResponse is Response<400>;
model UnauthorizedResponse is Response<401>;
model ForbiddenResponse is Response<403>;
model NotFoundResponse is Response<404>;
model ConflictResponse is Response<409>;
```

The success-side models are `OkResponse` (200), `CreatedResponse` (201), `AcceptedResponse` (202), `NoContentResponse` (204), `MovedResponse` (301) and `NotModifiedResponse` (304). There is no ready-made model for 422 or for any 5xx code. `Response<422>` covers those.

These models have a status code and nothing else. They are not marked `@error`. Used alone, they give a response with no body:

```typespec
@route("/c1") @get op c1(): Booking | NotFoundResponse;
```

```yaml
'404':
  description: The server cannot find the requested resource.
```

```ts
/** @description The server cannot find the requested resource. */
404: {
    headers: {
        [name: string]: unknown;
    };
    content?: never;
};
```

To add a body, combine the model with a body type. All three spellings below compile:

```typespec
// intersection with a named model
op c2(): Booking | (ConflictResponse & ApiError);

// spread into a named envelope
model Conflict {
  ...ConflictResponse;
  @body body: ApiError;
}
op c3(): Booking | Conflict;

// intersection with an anonymous body
op p(): Booking | (ConflictResponse & Body<{ reason: string }>);
```

The first two emit the same response, and the body schema is a `$ref` to `ApiError`:

```yaml
'409':
  description: The request conflicts with the current state of the server.
  content:
    application/json:
      schema:
        $ref: '#/components/schemas/ApiError'
```

The envelope model `Conflict` does not appear in `components.schemas`. The third spelling emits the body schema inline, so the generated type has no name and can only be reached through `operations["p"]["responses"][409]["content"]["application/json"]`.

Note that `ApiError` here is the `@error` model from form 1. Once it is combined with `ConflictResponse` it has an explicit status, so it emits `409` and not `default`.

### 4. Specific errors plus a fallback on one operation

```typespec
@error
model NotFoundError {
  @statusCode _: 404;
  code: "not_found";
  message: string;
}

@route("/e") @post op e(): {
  @statusCode _: 201;
  @body body: Booking;
} | NotFoundError | SlotTakenError | ApiError;
```

```yaml
responses:
  '201':
    description: The request has succeeded and a new resource has been created as a result.
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/Booking'
  '404':
    description: The server cannot find the requested resource.
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/NotFoundError'
  '409':
    description: The request conflicts with the current state of the server.
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/SlotTakenError'
  default:
    description: An unexpected error response.
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/ApiError'
```

The generated `responses` type has the keys `201`, `404`, `409` and `default`, each shaped as in the earlier excerpts.

A shared set of errors can live in an alias and be added to each operation. `alias CommonErrors = NotFoundError | ApiError;` with `op l(): Booking | CommonErrors;` emitted `200`, `404` and `default`.

### 5. Two bodies under one status code

```typespec
@error
model OutsideHoursError {
  @statusCode _: 409;
  code: "outside_hours";
  message: string;
}

@route("/f") @post op f(): Booking | SlotTakenError | OutsideHoursError;
```

```yaml
'409':
  description: The request conflicts with the current state of the server.
  content:
    application/json:
      schema:
        anyOf:
          - $ref: '#/components/schemas/SlotTakenError'
          - $ref: '#/components/schemas/OutsideHoursError'
```

```ts
409: {
    content: {
        "application/json": components["schemas"]["SlotTakenError"] | components["schemas"]["OutsideHoursError"];
    };
};
```

Because each `code` is a string literal, the TypeScript union is discriminated by `code`. The emitter writes `anyOf` with no OpenAPI `discriminator` object.

The alternative is one model whose `code` is a union:

```typespec
@error
model BookingConflict {
  @statusCode _: 409;
  code: "slot_taken" | "outside_hours";
  message: string;
  @header("Retry-After") retryAfter?: int32;
}
```

```yaml
BookingConflict:
  type: object
  required:
    - code
    - message
  properties:
    code:
      type: string
      enum:
        - slot_taken
        - outside_hours
    message:
      type: string
```

The `@header` property leaves the body and becomes a response header, which `openapi-typescript` types:

```ts
409: {
    headers: {
        "Retry-After"?: number;
        [name: string]: unknown;
    };
    content: {
        "application/json": components["schemas"]["BookingConflict"];
    };
};
```

### 6. Status code unions and ranges

```typespec
@error
model ValidationError {
  @statusCode _: 400 | 422;
  message: string;
}

@error
model ClientError {
  @minValue(400) @maxValue(499) @statusCode _: int32;
  message: string;
}
```

`ValidationError` emits two responses, `'400'` and `'422'`, each with a `$ref` to the same schema. The 422 description is "Client error" because the library has no text for that code. `ClientError` emits the key `4XX`:

```yaml
4XX:
  description: Client error
  content:
    application/json:
      schema:
        $ref: '#/components/schemas/ClientError'
```

```ts
/** @description Client error */
"4XX": {
    content: {
        "application/json": components["schemas"]["ClientError"];
    };
};
```

### 7. Inheritance from an `@error` base

```typespec
model GoneError extends ApiError {
  @statusCode _: 410;
}
model Derived extends ApiError {}
```

Neither model carries `@error` itself. `Derived` still emits as `default`, which confirms that the flag is inherited. `GoneError` emits as `'410'`. Both schemas are `allOf` over the base, and `openapi-typescript` turns them into aliases:

```yaml
GoneError:
  type: object
  allOf:
    - $ref: '#/components/schemas/ApiError'
```

```ts
GoneError: components['schemas']['ApiError'];
```

### 8. Descriptions

A doc comment on an envelope model becomes the response description and also the schema description:

```typespec
/** The slot is already booked. */
@error
model DocumentedConflict {
  @statusCode _: 409;
  message: string;
}
```

```yaml
'409':
  description: The slot is already booked.
```

`@errorsDoc("Something went wrong.")` on an operation replaced the description of the `@error` responses of that operation that had no doc comment of their own, both `409` and `default`. `@returnsDoc("The booking.")` replaced the `200` description. `openapi-typescript` copies each description into a `/** @description ... */` comment.

## Problem details (RFC 9457)

No package in the pinned set defines a problem-details model. A case-insensitive search for `problem`, `7807` and `9457` in the `lib` directories of `@typespec/compiler`, `@typespec/http`, `@typespec/openapi` and `@typespec/openapi3` 1.18.0 found nothing. The upstream feature request, [microsoft/typespec#2553 "Add model to HTTP library for 'problem details'"](https://github.com/microsoft/typespec/issues/2553), was opened in October 2023 and is open in the backlog as of this research. The official error-handling tutorial uses hand-written `@error` models with `code` and `message` and does not mention problem details ([typespec.io, Handling errors](https://typespec.io/docs/getting-started/getting-started-rest/03-handling-errors/)).

A hand-written model compiles and emits the `application/problem+json` media type when it declares a `contentType` header:

```typespec
@error
model Problem<Status> {
  @statusCode _: Status;
  @header contentType: "application/problem+json";
  type: url;
  title: string;
  status: Status;
  detail?: string;
}

model ConflictProblem is Problem<409>;

@route("/m") @post op m(): Booking | ConflictProblem;
```

```yaml
'409':
  description: The request conflicts with the current state of the server.
  content:
    application/problem+json:
      schema:
        $ref: '#/components/schemas/ConflictProblem'
```

```yaml
ConflictProblem:
  type: object
  required:
    - type
    - title
    - status
  properties:
    type:
      type: string
      format: uri
    title:
      type: string
    status:
      type: number
      enum:
        - 409
    detail:
      type: string
```

The generated type keys the body by that media type, so consumers index `["content"]["application/problem+json"]`:

```ts
409: {
    content: {
        "application/problem+json": {
            /** Format: uri */
            type: string;
            title: string;
            /** @enum {number} */
            status: 409;
            detail?: string;
            instance?: string;
        };
    };
};
```

That excerpt comes from a second run that used the template instance directly, `op j(): Booking | Problem<409> | Problem<404>`, with one more optional property, `instance?: string`, on the template. In that spelling the emitter writes each body schema inline and adds nothing to `components.schemas`. Naming the instance with `model ConflictProblem is Problem<409>` produces the named component shown above.

## What `openapi-typescript` 7.13 generates

- One `operations[operationId]["responses"]` object per operation, keyed by status. Numeric codes are numeric keys (`409`), ranges are string keys (`"4XX"`), and the fallback is the key `default`.
- Each response has `headers` and `content`. `content` is keyed by media type. A response with no body has `content?: never`.
- Named models are in `components["schemas"]`. `components["responses"]` is `never`, because the TypeSpec emitter writes responses inline in each operation and never as reusable response components.
- Nothing ties the response keys together. There is no generated union of error bodies and no success or error helper type. Code that wants the 409 body writes the index path or the schema name.

I checked the index paths with `tsc --strict` (TypeScript 5.9 from the `api` package):

```ts
import type { operations } from './generated/schema.d.ts';

type Conflict = operations['o']['responses'][409]['content']['application/json'];
type Fallback = operations['n']['responses']['default']['content']['application/json'];

const c: Conflict = { code: 'slot_taken', message: 'x' };
// @ts-expect-error unknown code
const bad: Conflict = { code: 'nope', message: 'x' };
// @ts-expect-error no 404 declared on this operation
type Missing = operations['o']['responses'][404];
```

The file compiled with no errors, so both `@ts-expect-error` lines caught a real error. A status code that the contract does not declare for an operation is a compile error at the point of use.

## What this means for the booking contract

These are the options the facts leave open. The decision belongs to the "Error model and the conflict response" ticket.

- **Where the status code lives.** It can sit on the error model (`@statusCode _: 409` inside an `@error` model) or be attached at the operation (`ConflictResponse & ApiError`). The first gives one named schema per error. The second reuses one body schema under several status codes.
- **One error body or several.** A single `ApiError { code; message }` shared by all statuses gives one TypeScript type. A model per error with a literal `code` gives a discriminated union when two errors share a status. A single model with `code: "a" | "b"` gives one type with a closed list of codes.
- **Whether to declare a `default` response.** An `@error` model with no status code adds `default` to every operation that lists it. It documents "any other error" and gives the client a type for it. Leaving it out means the contract lists only the named statuses.
- **Whether `@error` is needed at all.** With an explicit status code it changes nothing in the OpenAPI document or the generated types. It still marks intent, lets `@errorsDoc` apply, and matters to other TypeSpec emitters if the project ever adds one.
- **Plain JSON or problem details.** Problem details need a hand-written model and the `application/problem+json` content type, which changes the key consumers index in the generated types. Fastify's own error replies would also need to match that shape, which this research did not examine.
- **Named or inline schemas.** Named models and named template instances land in `components["schemas"]`. Anonymous bodies and direct template instances are reachable only through the operation's index path.

## Not verified

- OpenAPI 3.1 output. The repo emits 3.0.0, and I did not compile with the emitter's `openapi-versions` option.
- How Fastify's built-in validation and not-found replies compare with any of these shapes.
- Behaviour of client or server code generators other than `openapi-typescript`.
- The typespec.io pages are the current published docs. They are not pinned to 1.18.0. Where the docs and the installed sources could differ, the claims above rest on the installed sources and on compiled output.
