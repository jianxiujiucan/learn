import { defineConfig, type UserConfigExport } from '@tarojs/cli';
import devConfig from './dev';
import prodConfig from './prod';

export default defineConfig<'webpack5'>(async (merge) => {
  const baseConfig: UserConfigExport<'webpack5'> = {
    projectName: 'growth-checkin',
    date: '2026-11-4',
    designWidth: 375,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      375: 2,
      828: 1.81 / 2,
    },
    sourceRoot: 'src',
    outputRoot: 'dist',
    plugins: [],
    defineConstants: {
      API_BASE_URL: JSON.stringify(
        process.env.TARO_APP_API_BASE || 'http://127.0.0.1:3001',
      ),
    },
    copy: {
      patterns: [],
      options: {},
    },
    framework: 'vue3',
    compiler: 'webpack5',
    cache: {
      enable: false,
    },
    mini: {
      postcss: {
        pxtransform: {
          enable: true,
          config: {},
        },
        cssModules: {
          enable: false,
          config: {
            namingPattern: 'module',
            generateScopedName: '[name]__[local]___[hash:base64:5]',
          },
        },
      },
    },
  };

  if (process.env.NODE_ENV === 'development') {
    return merge({}, baseConfig, devConfig);
  }
  return merge({}, baseConfig, prodConfig);
});
