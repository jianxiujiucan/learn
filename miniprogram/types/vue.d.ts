export {};

declare module 'vue' {
  export interface GlobalComponents extends JSX.IntrinsicElements {
    // Taro 把内置组件注册为 Vue 的全局组件
  }
}
