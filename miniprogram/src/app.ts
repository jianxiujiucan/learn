import { createApp } from 'vue';
import './app.scss';

const App = createApp({
  onShow() {
    // 入口组件不需要实现 render，Taro 会负责挂载页面。
  },
});

export default App;
