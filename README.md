# deno_elm_compiler

A partial port of @rtfeldman's [node-elm-compiler](https://github.com/rtfeldman/node-elm-compiler) to Deno.

| Supports              | node-elm-compiler                                                                           | deno-elm-compiler |
| --------------------- | ------------------------------------------------------------------------------------------- | ----------------- |
| compile               | ✅                                                                                          | ✅                |
| compileSync           | ✅                                                                                          | ❌                |
| compileWorker         | ✅                                                                                          | ❌                |
| compileToString       | ✅                                                                                          | ✅                |
| compileToStringSync   | ✅                                                                                          | ❌                |
| compileToModule       | ❌                                                                                          | ✅                |
| compileToModuleString | ❌                                                                                          | ✅                |
| findAllDependencies   | ✅ imported from [find-elm-dependencies](https://github.com/NoRedInk/find-elm-dependencies) | ❌                |
| \_prepareProcessArgs  | ✅                                                                                          | ❌                |

---

## Usage

Given some Elm code like

```Elm
module Main exposing (main)

import Html


main =
    Html.text "Hello from Elm!"
```

in a build file do

```typescript
import { compileToModule } from "https://deno.land/x/deno_elm_compiler@0.1.0/compiler.ts";

await compileToModuleString("./src/Main.elm", { output: "./src/elm.js" });
```

then you can consume your Elm code like any of the following

```javascript
import Elm from "./src/elm.js";

Elm.Main.init();

//----------- OR ---------------

import { Main } from "./src/elm.js";

Main.init({ node: document.getElementById("elm-root") });
```

For more details on Elm and Javascript interop, see [the Elm docs](https://guide.elm-lang.org/interop/).
