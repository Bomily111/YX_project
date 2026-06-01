import AppConfig from '@/config/AppConfig';

// 通过 toString/valueOf 实现懒获取，在模板字符串 `${ipServer}` 中自动调用
export const ipServer = {
  toString() { return (new AppConfig()).getConfig()?.ipServer ?? ''; },
  valueOf()  { return (new AppConfig()).getConfig()?.ipServer ?? ''; },
} as unknown as string;
