/// <reference types="@tarojs/taro" />

declare module '*.png';
declare module '*.gif';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.svg';
declare module '*.css';
declare module '*.less';
declare module '*.scss';
declare module '*.sass';
declare module '*.styl';

/** 由 config/index.ts 的 defineConstants 注入 */
declare const API_BASE_URL: string;

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production';
    TARO_ENV: 'weapp' | 'h5' | 'swan' | 'alipay' | 'tt' | 'qq' | 'jd' | 'rn';
    TARO_APP_API_BASE?: string;
  }
}

declare module '@tarojs/components' {
  export * from '@tarojs/components/types/index.vue3';
}
