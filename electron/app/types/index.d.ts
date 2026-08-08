interface FastApiEnv extends NodeJS.ProcessEnv {
  /** Same runtime FastAPI origin used by the Electron renderer and Next.js. */
  NEXT_PUBLIC_FAST_API?: string;
  /** Absolute path to the bundled/resolved ImageMagick executable. */
  IMAGEMAGICK_BINARY?: string;
  MAGICK_HOME?: string;
  MAGICK_CONFIGURE_PATH?: string;
  /** Absolute path to the bundled LiteParse runner script. */
  LITEPARSE_RUNNER_PATH?: string;
  /** Binary used by LiteParse to execute its runner. */
  LITEPARSE_NODE_BINARY?: string;
  /** Root directory of the bundled presentation export runtime. */
  EXPORT_PACKAGE_ROOT?: string;
  EXPORT_RUNTIME_DIR?: string;
  PUPPETEER_EXECUTABLE_PATH?: string;
  PUPPETEER_CACHE_DIR?: string;
  PUPPETEER_TMP_DIR?: string;
  BUILT_PYTHON_MODULE_PATH?: string;
}

interface NextJsEnv extends NodeJS.ProcessEnv {
  NEXT_PUBLIC_FAST_API?: string;
  /** SSR, route handlers, and proxy middleware use this loopback URL. */
  FAST_API_INTERNAL_URL?: string;
  USER_CONFIG_PATH?: string;
  APP_DATA_DIRECTORY?: string;
  DISABLE_AUTH?: string;
  EXPORT_PACKAGE_ROOT?: string;
  PRESENTON_APP_ROOT?: string;
  PUPPETEER_EXECUTABLE_PATH?: string;
  PUPPETEER_CACHE_DIR?: string;
  PUPPETEER_TMP_DIR?: string;
  BUILT_PYTHON_MODULE_PATH?: string;
}

interface UserConfig {
  [key: string]: string | boolean | undefined;
}

interface IPCStatus {
  success: boolean;
  message?: string;
}
