import {withSentryConfig} from '@sentry/nextjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let userConfig = undefined
try {
  // try to import ESM first
  userConfig = await import('./v0-user-next.config.mjs')
} catch (e) {
  try {
    // fallback to CJS import
    userConfig = await import("./v0-user-next.config");
  } catch (innerError) {
    // ignore error
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    webpackBuildWorker: true,
    // Отключаем параллельную компиляцию - частая причина "call" ошибок
    parallelServerBuildTraces: false,
    parallelServerCompiles: false,
  },
  webpack: (config, { dev, isServer }) => {
    // Отключаем кэширование только по явной переменной окружения
    if (process.env.NEXT_WEBPACK_CACHE === 'false') {
      config.cache = false;
    }

    // Настройки для решения проблем с PackFileCacheStrategy
    if (config.cache && typeof config.cache === 'object') {
      config.cache.type = 'filesystem';
      config.cache.buildDependencies = {
        config: [__filename],
      };
      config.cache.cacheDirectory = join(__dirname, '.next', 'cache');
      config.cache.maxMemoryGenerations = 1;
      config.cache.compression = 'gzip';
      config.cache.hashAlgorithm = 'md4';
    }

    // Дополнительные оптимизации для dev режима
    if (dev) {
      config.optimization = {
        ...config.optimization,
        removeAvailableModules: false,
        removeEmptyChunks: false,
        splitChunks: false,
      };

      // Задержка HMR для стабильности
      config.watchOptions = {
        aggregateTimeout: 500,  // Ждёт 500мс после изменения
        // НЕ используем polling - fs events более эффективны на macOS
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/.next/**',
          '**/out/**',
          '**/*.log',
        ],
      };
    }

    return config;
  },
}

if (userConfig) {
  // ESM imports will have a "default" property
  const config = userConfig.default || userConfig

  for (const key in config) {
    if (
      typeof nextConfig[key] === 'object' &&
      !Array.isArray(nextConfig[key])
    ) {
      nextConfig[key] = {
        ...nextConfig[key],
        ...config[key],
      }
    } else {
      nextConfig[key] = config[key]
    }
  }
}

export default withSentryConfig(nextConfig, {
// For all available options, see:
// https://www.npmjs.com/package/@sentry/webpack-plugin#options

org: "eneca",
project: "eneca",

// Only print logs for uploading source maps in CI
silent: !process.env.CI,

// For all available options, see:
// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

// Upload a larger set of source maps for prettier stack traces (increases build time)
widenClientFileUpload: true,

// Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
// This can increase your server load as well as your hosting bill.
// Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
// side errors will fail.
 tunnelRoute: "/_relay",

// Webpack-specific options
webpack: {
  // Automatically tree-shake Sentry logger statements to reduce bundle size
  treeshake: {
    removeDebugLogging: true,
  },
  // Enables automatic instrumentation of Vercel Cron Monitors
  automaticVercelMonitors: true,
},
},
);