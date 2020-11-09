import * as path from "https://deno.land/std@0.77.0/path/mod.ts";

type Sources = string | Array<string>;

export type Mode = "debug" | "optimize" | "no_mode";

interface Options {
  run: (o: Deno.RunOptions) => Deno.Process;
  mode: Mode;
  pathToElm: string;
  cwd?: string;
  help?: any;
  output?: any;
  report?: any;
  verbose: boolean;
  processOpts?: any;
  docs?: any;
}

interface UserOptions {
  run?: (o: Deno.RunOptions) => Deno.Process;
  mode?: Mode;
  cwd?: string;
  pathToElm?: string;
  help?: any;
  output?: any;
  report?: any;
  verbose?: boolean;
  processOpts?: any;
  docs?: any;
}

const ELM_BINARY_NAME = "elm";
const defaultOptions: Options = {
  run: Deno.run,
  mode: "no_mode",
  pathToElm: ELM_BINARY_NAME,
  cwd: undefined,
  help: undefined,
  output: undefined,
  report: undefined,
  verbose: false,
  processOpts: undefined,
  docs: undefined,
};
const supportedOptions = Object.keys(defaultOptions);

function prepareSources(sources: Sources) {
  if (!(sources instanceof Array || typeof sources === "string")) {
    throw "compile() received neither an Array nor a String for its sources argument.";
  }

  return typeof sources === "string" ? [sources] : sources;
}

function prepareOptions(options?: UserOptions): Options {
  if (options == null) {
    return defaultOptions;
  }

  return { ...defaultOptions, ...options };
}

function prepareProcessArgs(sources: Sources, options: Options) {
  const preparedSources = prepareSources(sources);
  const compilerArgs = compilerArgsFromOptions(options);

  return ["make"].concat(
    preparedSources ? preparedSources.concat(compilerArgs) : compilerArgs
  );
}

function prepareProcessOpts(options: Options) {
  const env = {
    LANG: "en_US.UTF-8",
    ...Deno.env.toObject(),
  };
  return {
    env,
    stdio: "inherit",
    cwd: options.cwd,
    ...options.processOpts,
  };
}

function buildElmProcess(
  sources: Sources,
  options: Options,
  pathToElm: string
): Deno.Process {
  if (typeof options.run !== "function") {
    throw `options.run was a(n) ${typeof options.run} instead of a function.`;
  }

  const processArgs = prepareProcessArgs(sources, options);
  const processOpts = prepareProcessOpts(options);

  if (options.verbose) {
    console.log(["Running", pathToElm].concat(processArgs).join(" "));
  }

  return options.run({
    ...processOpts,
    cmd: [pathToElm, ...processArgs],
  });
}

function compilerErrorToString(err: any, pathToElm: string) {
  if (typeof err === "object" && typeof err.code === "string") {
    switch (err.code) {
      case "ENOENT":
        return `Could not find Elm compiler "${pathToElm}". Is it installed?`;

      case "EACCES":
        return `Elm compiler ${pathToElm}" did not have permission to run. Do you need to give it executable permissions?`;

      default:
        return `Error attempting to run Elm compiler "${pathToElm}":\n${err}`;
    }
  } else if (typeof err === "object" && typeof err.message === "string") {
    return JSON.stringify(err.message);
  } else {
    return `Exception thrown when attempting to run Elm compiler ${JSON.stringify(
      pathToElm
    )}`;
  }
}

async function compile(sources: Sources, options?: UserOptions) {
  const optionsWithDefaults = prepareOptions(options);
  const pathToElm = optionsWithDefaults.pathToElm;
  const process = buildElmProcess(sources, optionsWithDefaults, pathToElm);
  try {
    const { success, code } = await process.status();

    if (!success) {
      throw { code };
    }
  } catch (error) {
    throw compilerErrorToString(error, pathToElm);
  } finally {
    await process.close();
  }
}

// write compiled Elm to a string output
// returns a Promise which will contain a Buffer of the text
// If you want html instead of js, use options object to set
// output to a html file instead
// creates a temp file and deletes it after reading
async function compileToString(sources: Sources, options?: UserOptions) {
  const decoder = new TextDecoder("utf-8");
  const internalOptions: UserOptions = { ...options };
  const tempDir = await Deno.makeTempDir();
  internalOptions.output = path.join(
    tempDir,
    internalOptions.output || "elm.js"
  );
  internalOptions.processOpts = { stdout: "piped", stderr: "piped" };

  const optionsWithDefaults = prepareOptions(internalOptions);
  const pathToElm = optionsWithDefaults.pathToElm;
  const process = buildElmProcess(sources, optionsWithDefaults, pathToElm);
  const stderr = await process.stderrOutput();
  await process.output();
  const standardError = decoder.decode(stderr);

  if (standardError) {
    throw standardError;
  }

  const { success, code } = await process.status();

  if (!success) {
    console.log("failure", code);
  }

  await process.close();
  const data = await Deno.readFile(optionsWithDefaults.output);

  const compiledElm = decoder.decode(data);

  await Deno.remove(tempDir, { recursive: true });
  return compiledElm;
}

async function compileToModule(sources: Sources, options?: UserOptions) {
  const outputPath = options?.output || "elm.js";
  const result = await compileToModuleString(sources, options);

  const encoder = new TextEncoder();
  const data = encoder.encode(result);
  await Deno.writeFile(outputPath, data);
}

async function compileToModuleString(sources: Sources, options?: UserOptions) {
  const outputPath = options?.output || "elm.js";
  const initial = await compileToString(sources, {
    ...options,
    output: outputPath,
  });
  const intermitent = initial
    .replace("(function(scope){", "function init(scope){")
    .replace(";}(this));", ";}");

  const result = `${intermitent}
  const moduleScope = {};
  init(moduleScope);
  export default moduleScope.Elm;`;

  return result;
}

// Converts an object of key/value pairs to an array of arguments suitable
// to be passed to run for `elm make`.
function compilerArgsFromOptions(options: Options): Array<string> {
  return Object.entries(options).flatMap(function ([opt, value]) {
    if (value) {
      switch (opt) {
        case "help":
          return ["--help"];
        case "output":
          return ["--output", value];
        case "report":
          return ["--report", value];
        case "mode": {
          switch (value) {
            case "debug":
              return ["--debug"];
            case "optimize":
              return ["--optimize"];
            case "no_mode":
              return [];
          }
        }
        case "docs":
          return ["--docs", value];
        case "runtimeOptions":
          return ["+RTS", value, "-RTS"];
        default:
          if (supportedOptions.indexOf(opt) === -1) {
            if (opt === "yes") {
              throw new Error(
                "deno-elm-compiler received the `yes` option, but that was removed in Elm 0.19. Try re-running without passing the `yes` option."
              );
            } else if (opt === "warn") {
              throw new Error(
                "deno-elm-compiler received the `warn` option, but that was removed in Elm 0.19. Try re-running without passing the `warn` option."
              );
            } else if (opt === "pathToMake") {
              throw new Error(
                "deno-elm-compiler received the `pathToMake` option, but that was renamed to `pathToElm` in Elm 0.19. Try re-running after renaming the parameter to `pathToElm`."
              );
            } else {
              throw new Error(
                "deno-elm-compiler was given an unrecognized Elm compiler option: " +
                  opt
              );
            }
          }

          return [];
      }
    } else {
      return [];
    }
  });
}

export { compile, compileToModule, compileToString, compileToModuleString };
