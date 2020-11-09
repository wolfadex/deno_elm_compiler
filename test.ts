import * as path from "https://deno.land/std@0.77.0/path/mod.ts";
import { exists } from "https://deno.land/std@0.77.0/fs/mod.ts";
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.77.0/testing/asserts.ts";
import { compile, compileToString } from "./compiler.ts";

const DEFAULT_ENTRY = "./fixtures/Main.elm";
const TEST_OUTPUT_DIR = "./tmp";
const TEST_OUTPUT_FILE = path.join(TEST_OUTPUT_DIR, "test.elm.js");

Deno.test("basic compile", async function (): Promise<void> {
  const defaultPath = "./index.html";

  await compile(DEFAULT_ENTRY);

  const fileExists = await exists(defaultPath);

  try {
    assert(fileExists, "Compiles to basic index.html");
    await Deno.remove(defaultPath);
  } catch (err) {
    throw err;
  }
});

Deno.test("fails with bad source", async function () {
  try {
    await compile("");
  } catch (err) {
    assertEquals(
      err.indexOf("Exception thrown when attempting to run Elm compiler"),
      0
    );
  }
});

Deno.test("compiles with outut", async function (): Promise<void> {
  await compile(DEFAULT_ENTRY, {
    output: TEST_OUTPUT_FILE,
  });

  const fileExists = await exists(TEST_OUTPUT_FILE);

  try {
    assert(fileExists);
    await cleanup();
  } catch (err) {
    throw err;
  }
});

Deno.test(
  "Doesn't compile with 'optimize' and 'Debug.funcs' in the source code",
  async function () {
    try {
      await compile(DEFAULT_ENTRY, {
        output: TEST_OUTPUT_FILE,
        mode: "optimize",
      });
      console.log("no err");
    } catch (err) {
      assertEquals(
        err.indexOf("Exception thrown when attempting to run Elm compiler"),
        0
      );
    }
  }
);

Deno.test("compiles to a string", async function () {
  const result = await compileToString(DEFAULT_ENTRY);
  const [firstLine] = result.split("\n");
  assert(firstLine === "(function(scope){");
});

async function cleanup() {
  await Deno.remove(TEST_OUTPUT_DIR, { recursive: true });
}
